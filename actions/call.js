"use server";

import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { StreamClient } from "@stream-io/node-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { revalidatePath } from "next/cache";

export const getCallData = async (callId) => {
  const user = await currentUser();
  if (!user) return { error: "Unauthorized" };

  const booking = await db.booking.findUnique({
    where: { streamCallId: callId },
    include: {
      interviewer: {
        select: {
          id: true,
          clerkUserId: true,
          name: true,
          imageUrl: true,
          categories: true,
        },
      },
      interviewee: {
        select: {
          id: true,
          clerkUserId: true,
          name: true,
          imageUrl: true,
        },
      },
    },
  });

  if (!booking) return { error: "Call not found" };

  const isInterviewer = booking.interviewer.clerkUserId === user.id;
  const isInterviewee = booking.interviewee.clerkUserId === user.id;
  if (!isInterviewer && !isInterviewee) return { error: "Forbidden" };

  const streamClient = new StreamClient(
    process.env.NEXT_PUBLIC_STREAM_API_KEY,
    process.env.STREAM_SECRET_KEY
  );

  const token = streamClient.generateUserToken({
    user_id: user.id,
    validity_in_seconds: 60 * 60,
  });

  return {
    token,
    isInterviewer,
    currentUser: {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      imageUrl: user.imageUrl,
    },
    booking: {
      id: booking.id,
      interviewer: booking.interviewer,
      interviewee: booking.interviewee,
      categories: booking.interviewer.categories,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
    },
  };
};

export const generateAndSaveFeedback = async (bookingId, transcript) => {
  const user = await currentUser();
  if (!user) return { error: "Unauthorized" };

  if (!bookingId) {
    return { error: "No booking ID" };
  }

  try {
    await db.booking.update({
      where: { id: bookingId },
      data: { status: "COMPLETED" },
    });
  } catch (dbError) {
    console.error(dbError);
    return { error: "Database failed to update status" };
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const safeTranscript = transcript || "No words were spoken during this interview.";

    const prompt = `Analyze the following interview transcript and generate a detailed feedback report in JSON format with the following schema:
{
  "summary": "Brief summary of the interview",
  "technical": "Technical skills assessment",
  "communication": "Communication skills evaluation",
  "problemSolving": "Problem-solving abilities assessment",
  "recommendation": "Overall recommendation",
  "strengths": ["strength1", "strength2"],
  "improvements": ["improvement1", "improvement2"],
  "overallRating": "AVERAGE",
  "sessionRating": 85
}

Note: overallRating must be exactly one of: POOR, AVERAGE, GOOD, EXCELLENT.

Transcript:
${safeTranscript}

Respond with valid JSON only, no markdown formatting.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const cleanJson = responseText.replace(/^```json|^```|```$/gm, "").trim();
    const feedbackData = JSON.parse(cleanJson);

    await db.feedback.create({
      data: {
        bookingId,
        summary: feedbackData.summary,
        technical: feedbackData.technical,
        communication: feedbackData.communication,
        problemSolving: feedbackData.problemSolving,
        recommendation: feedbackData.recommendation,
        strengths: feedbackData.strengths,
        improvements: feedbackData.improvements,
        overallRating: feedbackData.overallRating,
        sessionRating: feedbackData.sessionRating
      }
    });
  } catch (aiError) {
    console.error(aiError);
  }

  revalidatePath("/dashboard");
  revalidatePath("/appointments");

  return { success: true };
};
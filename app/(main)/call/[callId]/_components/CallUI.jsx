"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useRouter } from "next/navigation";

// Stream Video
import {
  StreamVideoClient,
  StreamVideo,
  StreamCall,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import "stream-chat-react/dist/css/v2/index.css";

import { Loader2 } from "lucide-react";
import CallUI from "./CallUI";

export default function CallRoom({
  callId,
  token,
  apiKey,
  currentUser,
  booking,
  isInterviewer,
}) {
  const router = useRouter();
  const [videoClient, setVideoClient] = useState(null);
  const [call, setCall] = useState(null);
  const clientRef = useRef(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invoke in development
    if (joinedRef.current) return;
    joinedRef.current = true;

    const client = new StreamVideoClient({
      apiKey,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        image: currentUser.imageUrl,
      },
      token,
    });

    const callInstance = client.call("default", callId);

    callInstance
      .join({ create: false })
      .then(() => {
        clientRef.current = client;
        setVideoClient(client);
        setCall(callInstance);
      })
      .catch(console.error);

    return () => {
      callInstance.leave().catch(() => {});
      client.disconnectUser().catch(() => {});
      clientRef.current = null;
      joinedRef.current = false; // reset so hot reload works
    };
  }, [
    apiKey,
    callId,
    currentUser.id,
    currentUser.imageUrl,
    currentUser.name,
    token,
  ]);

  const handleLeave = useCallback(() => {
    router.push(isInterviewer ? "/dashboard" : "/appointments");
  }, [isInterviewer, router]);

  if (!videoClient || !call) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center gap-3">
        <Loader2 size={28} className="text-amber-400 animate-spin" />
        <p className="text-stone-500 text-sm font-light">Connecting to call…</p>
      </div>
    );
  }

  return (
    <StreamVideo client={videoClient}>
      <StreamCall call={call}>
        <CallUI
          callId={callId}
          isInterviewer={isInterviewer}
          booking={booking}
          onLeave={handleLeave}
          apiKey={apiKey}
          token={token}
          currentUser={currentUser}
        />
      </StreamCall>
    </StreamVideo>
  );
}

// ─── Call UI (inside StreamCall context) ─────────────────────────────────────

import { generateAndSaveFeedback } from "@/actions/call";

// Stream Video
import {
  StreamTheme,
  SpeakerLayout,
  useCallStateHooks,
  useCall,
  CallingState,
  CallControls,
} from "@stream-io/video-react-sdk";

// Stream Chat
import {
  Chat,
  Channel,
  MessageList,
  MessageInput,
  Window,
  useCreateChatClient,
} from "stream-chat-react";

import { Badge } from "@/components/ui/badge";
import { MessageSquare, Sparkles, Loader2, X } from "lucide-react";
import AIQuestionsPanel from "./AIQuestions";

export function CallUI({
  callId,
  isInterviewer,
  booking,
  onLeave,
  apiKey,
  token,
  currentUser,
}) {
  const { useCallCallingState } = useCallStateHooks();
  const call = useCall();
  const callingState = useCallCallingState();

  const [activeTab, setActiveTab] = useState("chat");
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false); // New Mobile Toggle State

  // ── Chat client — same token works for both Video + Chat SDKs ──
  const chatClient = useCreateChatClient({
    apiKey,
    tokenOrProvider: token,
    userData: {
      id: currentUser.id,
      name: currentUser.name,
      image: currentUser.imageUrl,
    },
  });

  const [chatChannel, setChatChannel] = useState(null);

  // Auto-stop recording before leaving
  const handleLeave = useCallback(async () => {
    if (isEndingCall) return;
    setIsEndingCall(true);
    
    console.log("Attempting to end call for booking ID:", booking?.id);

    try {
      if (call) {
        const isRecording = call.state?.recording;
        if (isRecording) {
          await call.stopRecording().catch(() => {});
        }
        
        // Get transcript from chat messages
      let transcript = "";
        if (chatChannel && chatChannel.state && chatChannel.state.messages) {
          transcript = chatChannel.state.messages
            .map(msg => `${msg.user?.name || 'Unknown'}: ${msg.text}`)
            .join('\n');
        }

        // ALWAYS execute this, even if transcript is empty, so status updates to COMPLETED
        if (booking?.id) {
          console.log("Sending to server. Transcript length:", transcript.length);
          await generateAndSaveFeedback(booking.id, transcript);
        } else {
          console.error("No booking ID found in frontend!");
        }

        await call.leave().catch(() => {});
      }
    } catch (error) {
      console.error("Error ending call:", error);
    } finally {
      onLeave();
    }
  }, [isEndingCall, call, onLeave, chatChannel, booking?.id]);

  useEffect(() => {
    if (!chatClient) return;

    const channel = chatClient.channel("messaging", callId, {
      name: "Interview Chat",
      members: [
        booking.interviewer.clerkUserId,
        booking.interviewee.clerkUserId,
      ],
    });

    channel
      .watch()
      .then(() => setChatChannel(channel))
      .catch(console.error);

    return () => {
      channel.stopWatching().catch(() => {});
    };
  }, [chatClient, callId, booking]);

  if (callingState === CallingState.LEFT) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center gap-3">
        <p className="text-stone-400 text-sm">Leaving call…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[92vh] bg-[#0a0a0b] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-white/10 text-stone-500 text-xs"
          >
            {booking.interviewer.name}
            <span className="text-stone-700 mx-1.5">×</span>
            {booking.interviewee.name}
          </Badge>
          {isInterviewer && (
            <Badge
              variant="outline"
              className="border-amber-400/20 bg-amber-400/5 text-amber-400 text-xs"
            >
              Interviewer
            </Badge>
          )}
        </div>
      </div>

      {/* Body: video + side panel */}
      {/* Added relative positioning here for the mobile chat overlay */}
      <div className="relative flex flex-1 min-h-0">
        
        {/* ── LEFT: Video ── */}
        <div className="flex flex-col flex-1 min-w-0">
          <StreamTheme>
            <SpeakerLayout participantBarPosition="bottom" />
            <CallControls onLeave={handleLeave} disabled={isEndingCall} />
          </StreamTheme>
        </div>

        {/* ── RIGHT: Chat / AI panel ── */}
        <div 
          className={`
            ${showMobileChat ? 'flex' : 'hidden'} 
            md:flex 
            absolute inset-0 z-50 
            md:relative md:w-85 md:z-auto 
            shrink-0 flex-col border-l border-white/8 bg-[#0a0a0b]
          `}
        >
          {/* Mobile-only close header */}
          <div className="md:hidden flex items-center justify-between p-3 border-b border-white/8 bg-black shrink-0">
            <span className="text-white text-sm font-medium">Chat & Tools</span>
            <button onClick={() => setShowMobileChat(false)} className="p-1 text-stone-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Tab switcher */}
          <div className="flex border-b border-white/8 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors ${
                activeTab === "chat"
                  ? "text-amber-400 border-b-2 border-amber-400"
                  : "text-stone-500 hover:text-stone-300"
              }`}
            >
              <MessageSquare size={13} />
              Chat
            </button>

            {/* AI Questions tab — interviewer only */}
            {isInterviewer && (
              <button
                type="button"
                onClick={() => setActiveTab("ai")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors ${
                  activeTab === "ai"
                    ? "text-amber-400 border-b-2 border-amber-400"
                    : "text-stone-500 hover:text-stone-300"
                }`}
              >
                <Sparkles size={13} />
                AI Questions
              </button>
            )}
          </div>

          {/* Panel content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === "chat" ? (
              chatClient && chatChannel ? (
                <Chat client={chatClient} theme="str-chat__theme-dark">
                  <Channel channel={chatChannel}>
                    <Window>
                      <MessageList />
                      <MessageInput focus />
                    </Window>
                  </Channel>
                </Chat>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={18} className="text-stone-600 animate-spin" />
                </div>
              )
            ) : (
              <div className="p-4 h-full overflow-y-scroll max-h-screen">
                <AIQuestionsPanel categories={booking.categories} />
              </div>
            )}
          </div>
        </div>

        {/* ── Mobile Floating Action Button ── */}
        {!showMobileChat && (
          <button
            onClick={() => setShowMobileChat(true)}
            className="md:hidden absolute bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 shadow-lg shadow-black/50 text-black hover:bg-amber-400 transition-colors"
          >
            <MessageSquare size={24} />
          </button>
        )}

      </div>
    </div>
  );
}
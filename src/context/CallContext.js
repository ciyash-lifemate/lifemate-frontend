import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { socket } from '../api/socket.js';
import { getWebRTC, isCallingSupported } from '../utils/calling.js';

const CallContext = createContext(null);

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

const IDLE_CALL = {
  status: 'idle', // idle | outgoing | incoming | connected
  callId: null,
  chatId: null,
  callType: null, // 'audio' | 'video'
  otherUserId: null,
  otherUserName: '',
  otherUserAvatar: null,
};

// Only one call can be active at a time. Mutable call state that socket
// event handlers need to read synchronously (they're registered once and
// would otherwise close over stale React state) lives in refs; the `call`
// state below is kept in sync purely for rendering.
export const CallProvider = ({ children }) => {
  const [call, setCall] = useState(IDLE_CALL);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const callRef = useRef(IDLE_CALL);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setCall(IDLE_CALL);
  }, []);

  const setupPeerConnection = useCallback((RTCPeerConnection, toUserId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      socket.emit('call:ice-candidate', {
        callId: callRef.current.callId,
        toUserId,
        candidate: event.candidate,
      });
    };
    pc.ontrack = (event) => setRemoteStream(event.streams[0]);
    pcRef.current = pc;
    return pc;
  }, []);

  const getLocalMedia = async (mediaDevices, callType) =>
    mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video' ? { facingMode: 'user' } : false,
    });

  // --- outgoing ---
  const startCall = useCallback(
    async (chatId, otherUserId, otherUserName, otherUserAvatar, callType) => {
      if (!isCallingSupported()) {
        Alert.alert('Not available', 'Calls need the LifeMate development build, not Expo Go.');
        return;
      }
      if (callRef.current.status !== 'idle') {
        Alert.alert('Already in a call', 'Please end the current call first.');
        return;
      }

      const RTC = getWebRTC();
      try {
        const stream = await getLocalMedia(RTC.mediaDevices, callType);
        localStreamRef.current = stream;
        setLocalStream(stream);
        setCall({
          status: 'outgoing',
          callId: null,
          chatId,
          callType,
          otherUserId,
          otherUserName,
          otherUserAvatar,
        });

        const pc = setupPeerConnection(RTC.RTCPeerConnection, otherUserId);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.timeout(15000).emit('call:invite', { chatId, toUserId: otherUserId, callType, offer }, (err, ack) => {
          if (err || !ack?.success) {
            Alert.alert('Call failed', 'Could not reach the other person.');
            cleanup();
            return;
          }
          setCall((prev) => (prev.status === 'idle' ? prev : { ...prev, callId: ack.callId }));
        });
      } catch (err) {
        Alert.alert('Call failed', err.message || 'Could not start the call.');
        cleanup();
      }
    },
    [cleanup, setupPeerConnection]
  );

  // --- incoming ---
  const acceptCall = useCallback(async () => {
    const current = callRef.current;
    if (current.status !== 'incoming') return;

    const RTC = getWebRTC();
    try {
      const stream = await getLocalMedia(RTC.mediaDevices, current.callType);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = setupPeerConnection(RTC.RTCPeerConnection, current.otherUserId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTC.RTCSessionDescription(pendingOfferRef.current));
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTC.RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call:answer', { callId: current.callId, toUserId: current.otherUserId, answer });

      setCall((prev) => ({ ...prev, status: 'connected' }));
    } catch (err) {
      Alert.alert('Call failed', err.message || 'Could not answer the call.');
      socket.emit('call:reject', { callId: current.callId, toUserId: current.otherUserId });
      cleanup();
    }
  }, [cleanup, setupPeerConnection]);

  const rejectCall = useCallback(() => {
    const current = callRef.current;
    if (current.status !== 'incoming') return;
    socket.emit('call:reject', { callId: current.callId, toUserId: current.otherUserId });
    cleanup();
  }, [cleanup]);

  const endCall = useCallback(() => {
    const current = callRef.current;
    if (current.status === 'idle') return;
    if (current.callId && current.otherUserId) {
      socket.emit('call:end', { callId: current.callId, toUserId: current.otherUserId });
    }
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const next = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setIsMuted(next);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const next = !isCameraOff;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
    setIsCameraOff(next);
  }, [isCameraOff]);

  const switchCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => t._switchCamera?.());
  }, []);

  // Global listeners for the whole app session - an incoming call can arrive
  // on any screen, not just while a chat is open.
  useEffect(() => {
    const onInvite = (payload) => {
      if (!isCallingSupported()) return; // can't answer anyway on this build
      if (callRef.current.status !== 'idle') {
        socket.emit('call:reject', { callId: payload.callId, toUserId: payload.from });
        return;
      }
      pendingOfferRef.current = payload.offer;
      pendingCandidatesRef.current = [];
      setCall({
        status: 'incoming',
        callId: payload.callId,
        chatId: payload.chatId,
        callType: payload.callType,
        otherUserId: payload.from,
        otherUserName: payload.fromName || 'Unknown',
        otherUserAvatar: payload.fromAvatar || null,
      });
    };

    const onAnswer = async ({ callId, answer }) => {
      if (callRef.current.callId !== callId || !pcRef.current) return;
      const RTC = getWebRTC();
      await pcRef.current.setRemoteDescription(new RTC.RTCSessionDescription(answer));
      setCall((prev) => (prev.callId === callId ? { ...prev, status: 'connected' } : prev));
    };

    const onIceCandidate = async ({ candidate }) => {
      const RTC = getWebRTC();
      if (!RTC || !candidate) return;
      if (pcRef.current?.remoteDescription) {
        try {
          await pcRef.current.addIceCandidate(new RTC.RTCIceCandidate(candidate));
        } catch {
          // Stray/late candidate for a call that already ended - ignore.
        }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    const onReject = ({ callId }) => {
      if (callRef.current.callId !== callId) return;
      Alert.alert('Call declined', `${callRef.current.otherUserName || 'They'} declined the call.`);
      cleanup();
    };

    const onEnd = ({ callId }) => {
      if (callRef.current.callId !== callId) return;
      cleanup();
    };

    socket.on('call:invite', onInvite);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:reject', onReject);
    socket.on('call:end', onEnd);
    return () => {
      socket.off('call:invite', onInvite);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:reject', onReject);
      socket.off('call:end', onEnd);
    };
  }, [cleanup]);

  const value = {
    call,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

export const useCall = () => useContext(CallContext);

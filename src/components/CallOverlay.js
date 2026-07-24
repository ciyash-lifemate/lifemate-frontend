import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar.js';
import { useCall } from '../context/CallContext.js';
import { getWebRTC } from '../utils/calling.js';
import { colors, radius, spacing, typography } from '../theme.js';

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

// Mounted once at the root so an incoming call can surface over any screen.
// Renders nothing while call.status is 'idle'.
export const CallOverlay = () => {
  const {
    call,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
  } = useCall();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (call.status !== 'connected') {
      setElapsed(0);
      return undefined;
    }
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [call.status]);

  if (call.status === 'idle') return null;

  const isVideo = call.callType === 'video';
  const RTC = getWebRTC();
  const RTCView = RTC?.RTCView;
  const showRemoteVideo = isVideo && remoteStream && RTCView;

  return (
    <View style={styles.overlay}>
      {showRemoteVideo ? (
        <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
      ) : null}

      <View style={styles.topInfo}>
        {!showRemoteVideo ? <Avatar name={call.otherUserName} uri={call.otherUserAvatar} size={96} /> : null}
        <Text style={styles.name}>{call.otherUserName}</Text>
        <Text style={styles.status}>
          {call.status === 'incoming'
            ? `Incoming ${call.callType} call…`
            : call.status === 'outgoing'
              ? 'Ringing…'
              : formatDuration(elapsed)}
        </Text>
      </View>

      {isVideo && localStream && RTCView && call.status !== 'incoming' ? (
        <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" zOrder={1} mirror />
      ) : null}

      <View style={styles.controls}>
        {call.status === 'incoming' ? (
          <View style={styles.incomingRow}>
            <Pressable style={[styles.circleBtn, styles.rejectBtn]} onPress={rejectCall} hitSlop={10}>
              <Ionicons name="call" size={26} color={colors.white} style={styles.rotatedIcon} />
            </Pressable>
            <Pressable style={[styles.circleBtn, styles.acceptBtn]} onPress={acceptCall} hitSlop={10}>
              <Ionicons name="call" size={26} color={colors.white} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.activeRow}>
            <Pressable style={styles.smallBtn} onPress={toggleMute} hitSlop={10}>
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={22} color={colors.white} />
            </Pressable>
            {isVideo ? (
              <Pressable style={styles.smallBtn} onPress={toggleCamera} hitSlop={10}>
                <Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={22} color={colors.white} />
              </Pressable>
            ) : null}
            {isVideo ? (
              <Pressable style={styles.smallBtn} onPress={switchCamera} hitSlop={10}>
                <Ionicons name="camera-reverse" size={22} color={colors.white} />
              </Pressable>
            ) : null}
            <Pressable style={[styles.circleBtn, styles.rejectBtn]} onPress={endCall} hitSlop={10}>
              <Ionicons name="call" size={26} color={colors.white} style={styles.rotatedIcon} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0B0B12',
    zIndex: 999,
    elevation: 999,
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  localVideo: {
    position: 'absolute',
    top: 60,
    right: spacing.lg,
    width: 100,
    height: 140,
    borderRadius: radius.md,
    backgroundColor: '#000',
  },
  topInfo: {
    alignItems: 'center',
    marginTop: 100,
  },
  name: {
    ...typography.h2,
    color: colors.white,
    marginTop: spacing.md,
  },
  status: {
    ...typography.body,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.xs,
  },
  controls: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  incomingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '80%',
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  circleBtn: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtn: {
    width: 50,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    backgroundColor: colors.success,
  },
  rejectBtn: {
    backgroundColor: colors.danger,
  },
  rotatedIcon: {
    transform: [{ rotate: '135deg' }],
  },
});

import { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radius, typography } from '../theme.js';

const PALETTE = [colors.primary, colors.pink, colors.blue, colors.success, colors.warning];

const colorFor = (name) => {
  const code = (name || '?').charCodeAt(0);
  return PALETTE[code % PALETTE.length];
};

export const Avatar = ({ name, size = 44, online, uri }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = (name || '?').trim().charAt(0).toUpperCase();

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {uri && !imageFailed ? (
        <Image
          source={{ uri }}
          onError={() => setImageFailed(true)}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <View
          style={[
            styles.circle,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(name) },
          ]}
        >
          <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
        </View>
      )}
      {online ? <View style={styles.dot} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    ...typography.button,
    color: colors.white,
  },
  dot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
  },
});

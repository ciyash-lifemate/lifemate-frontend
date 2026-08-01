import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

// Same left-to-right order as BottomNavBar's tabs, minus the center "AI"
// button - that one opens a chat, it isn't part of the swipe sequence.
const TAB_ORDER = ['/home', '/calendar', '/companies', '/profile'];

// A horizontal swipe anywhere on one of the four main tab screens moves to
// the next/previous tab, the way most tabbed apps work - BottomNavBar itself
// needed no changes for this, since it already derives which tab is active
// from the current route (usePathname()), so router.replace() here just
// naturally updates its highlight too.
//
// .activeOffsetX/.failOffsetY tell the gesture "only claim this touch once
// it's moved mostly sideways" - without that, a plain vertical scroll
// inside the screen's own ScrollView/FlatList would get eaten by this pan
// gesture instead of scrolling the list, since GestureDetector sits above it
// in the tree.
//
// replace(), not push(): a real finger swipe can fire several times in a
// row (swipe past Tasks straight to Calendar) - push()ing each hop would
// pile up a deep back-stack for what's conceptually just "switching tabs",
// not a sequence of screens to back out of one at a time.
export const useSwipeTabGesture = (currentPath) => {
  const router = useRouter();
  const index = TAB_ORDER.indexOf(currentPath);

  const goTo = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= TAB_ORDER.length) return;
    router.replace(TAB_ORDER[nextIndex]);
  };

  return Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      'worklet';
      if (e.translationX < -60 && index < TAB_ORDER.length - 1) {
        runOnJS(goTo)(index + 1);
      } else if (e.translationX > 60 && index > 0) {
        runOnJS(goTo)(index - 1);
      }
    });
};

// Wraps a tab screen's whole tree in the gesture above - `path` must be one
// of TAB_ORDER's own entries (the screen's own route).
export const SwipeableTabScreen = ({ path, children }) => {
  const gesture = useSwipeTabGesture(path);
  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
};

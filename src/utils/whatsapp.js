import { Linking } from 'react-native';

// There's no way to send a WhatsApp message with zero user interaction
// through the real consumer app (that's deliberate on WhatsApp's part, to
// stop spam/bots) - the closest thing available without a paid, business-
// verified WhatsApp Business Cloud API account is opening the chat with the
// message already typed in, one tap away from Send.
export const openWhatsAppWish = async (mobile, message) => {
  const digits = String(mobile || '').replace(/[^0-9]/g, '');
  if (!digits) return false;

  const encoded = encodeURIComponent(message);
  const appUrl = `whatsapp://send?phone=${digits}&text=${encoded}`;

  try {
    const supported = await Linking.canOpenURL(appUrl);
    await Linking.openURL(supported ? appUrl : `https://wa.me/${digits}?text=${encoded}`);
    return true;
  } catch {
    return false;
  }
};

export const buildWishMessage = (recipientName, wishMessage, senderName) => {
  const greeting = recipientName ? `Hi ${recipientName}! ` : '';
  const signature = senderName ? `\n\n- ${senderName}` : '';
  return `${greeting}${wishMessage || ''}${signature}`;
};

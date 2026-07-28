import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getCardTemplate } from '../constants/cardTemplates.js';

const CARD_WIDTH = 328;
const CARD_HEIGHT = 190;

const ContactRow = ({ icon, value, color }) =>
  value ? (
    <View style={styles.contactItem}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[styles.contactText, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  ) : null;

// Shared by every layout below - phone/email/website/address, in that order,
// each only rendered when present.
const ContactRows = ({ phone, email, website, address, color }) => (
  <View style={styles.contactRow}>
    <ContactRow icon="call" value={phone} color={color} />
    <ContactRow icon="mail" value={email} color={color} />
    <ContactRow icon="globe-outline" value={website} color={color} />
    <ContactRow icon="location-outline" value={address} color={color} />
  </View>
);

const FramedLayout = ({ t, name, roleLine, phone, email, website, address }) => (
  <View style={[styles.frameBorder, { borderColor: t.accent }]}>
    <View>
      <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{name}</Text>
      {roleLine ? <Text style={[styles.role, { color: t.muted }]} numberOfLines={1}>{roleLine}</Text> : null}
    </View>
    <View style={[styles.divider, { backgroundColor: t.accent }]} />
    <ContactRows phone={phone} email={email} website={website} address={address} color={t.text} />
  </View>
);

const BandLayout = ({ t, name, roleLine, phone, email, website, address }) => (
  <View style={styles.bandBody}>
    <View style={[styles.band, { backgroundColor: t.blockColor }]}>
      <Ionicons name="business" size={14} color={t.blockText} />
      <Text style={[styles.bandText, { color: t.blockText }]}>{roleLine || 'BUSINESS CARD'}</Text>
    </View>
    <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{name}</Text>
    <ContactRows phone={phone} email={email} website={website} address={address} color={t.text} />
  </View>
);

const SplitLayout = ({ t, name, roleLine, phone, email, website, address }) => (
  <View style={styles.splitRow}>
    <View style={[styles.splitBlock, { backgroundColor: t.blockColor }]}>
      <Ionicons name="person" size={26} color={t.blockText} />
    </View>
    <View style={styles.splitBody}>
      <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{name}</Text>
      {roleLine ? <Text style={[styles.role, { color: t.muted }]} numberOfLines={1}>{roleLine}</Text> : null}
      <ContactRows phone={phone} email={email} website={website} address={address} color={t.text} />
    </View>
  </View>
);

const MinimalLayout = ({ t, name, roleLine, phone, email, website, address }) => (
  <View style={styles.minimalBody}>
    <View style={[styles.minimalIcon, { borderColor: t.accent }]}>
      <Ionicons name="business" size={14} color={t.accent} />
    </View>
    <View>
      <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{name}</Text>
      {roleLine ? <Text style={[styles.role, { color: t.muted }]} numberOfLines={1}>{roleLine}</Text> : null}
      <ContactRows phone={phone} email={email} website={website} address={address} color={t.muted} />
    </View>
  </View>
);

const CornerLayout = ({ t, name, roleLine, phone, email, website, address }) => (
  <View style={styles.cornerBody}>
    <View style={[styles.cornerTriangle, { backgroundColor: t.blockColor }]} />
    <View>
      <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{name}</Text>
      {roleLine ? (
        <Text style={[styles.role, { color: t.muted }]} numberOfLines={1}>{roleLine}</Text>
      ) : null}
      <View style={[styles.thinAccent, { backgroundColor: t.accent }]} />
    </View>
    <ContactRows phone={phone} email={email} website={website} address={address} color={t.text} />
  </View>
);

const RibbonLayout = ({ t, name, roleLine, phone, email, website, address }) => (
  <View style={styles.ribbonBody}>
    <View style={[styles.ribbon, { backgroundColor: t.blockColor }]}>
      <Text style={[styles.ribbonText, { color: t.blockText }]}>PRO</Text>
    </View>
    <View>
      <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{name}</Text>
      {roleLine ? <Text style={[styles.role, { color: t.muted }]} numberOfLines={1}>{roleLine}</Text> : null}
    </View>
    <ContactRows phone={phone} email={email} website={website} address={address} color={t.text} />
  </View>
);

const CircleLayout = ({ t, name, roleLine, phone, email, website, address }) => (
  <View style={styles.circleBody}>
    <View style={[styles.circleBadge, { backgroundColor: t.blockColor }]}>
      <Text style={[styles.circleInitial, { color: t.accent }]}>
        {(name || '?').trim().charAt(0).toUpperCase()}
      </Text>
    </View>
    <View>
      <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{name}</Text>
      {roleLine ? <Text style={[styles.role, { color: t.muted }]} numberOfLines={1}>{roleLine}</Text> : null}
    </View>
    <ContactRows phone={phone} email={email} website={website} address={address} color={t.text} />
  </View>
);

const DualLayout = ({ t, name, roleLine, phone, email, website, address }) => (
  <View style={styles.dualRow}>
    <View style={[styles.dualLeft, { backgroundColor: t.blockColor }]}>
      <Text style={[styles.name, { color: t.blockText }]} numberOfLines={2}>{name}</Text>
      {roleLine ? (
        <Text style={[styles.role, { color: t.blockText, opacity: 0.85 }]} numberOfLines={2}>
          {roleLine}
        </Text>
      ) : null}
    </View>
    <View style={styles.dualRight}>
      <ContactRows phone={phone} email={email} website={website} address={address} color={t.text} />
    </View>
  </View>
);

const StackedLayout = ({ t, name, roleLine, phone, email, website, address }) => (
  <View style={styles.stackedBody}>
    <View style={[styles.stackedPeek, { backgroundColor: t.accent }]} />
    <View>
      <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{name}</Text>
      {roleLine ? <Text style={[styles.role, { color: t.muted }]} numberOfLines={1}>{roleLine}</Text> : null}
    </View>
    <ContactRows phone={phone} email={email} website={website} address={address} color={t.text} />
  </View>
);

const BottomBandLayout = ({ t, name, roleLine, phone, email, website, address }) => (
  <View style={styles.bottomBandBody}>
    <View style={styles.bottomBandTop}>
      <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{name}</Text>
      {roleLine ? <Text style={[styles.role, { color: t.muted }]} numberOfLines={1}>{roleLine}</Text> : null}
    </View>
    <View style={[styles.bottomBand, { backgroundColor: t.blockColor }]}>
      <ContactRow icon="call" value={phone} color={t.blockText} />
      <ContactRow icon="mail" value={email} color={t.blockText} />
      <ContactRow icon="globe-outline" value={website} color={t.blockText} />
    </View>
  </View>
);

const DiagonalLayout = ({ t, name, roleLine, phone, email, website, address }) => (
  <View style={styles.diagonalBody}>
    <View style={[styles.diagonalOverlay, { backgroundColor: t.blockColor }]} />
    <View>
      <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>{name}</Text>
      {roleLine ? <Text style={[styles.role, { color: t.muted }]} numberOfLines={1}>{roleLine}</Text> : null}
    </View>
    <ContactRows phone={phone} email={email} website={website} address={address} color={t.text} />
  </View>
);

// Modeled after a real printed card: name + designation up top with contact
// rows in circular icon badges, the company name as a two-tone "logo"
// stacked at the bottom, and thin accent bars top/bottom.
const CorporateContactRow = ({ icon, value, badgeColor, badgeTextColor }) =>
  value ? (
    <View style={styles.corporateContactItem}>
      <View style={[styles.corporateIconBadge, { backgroundColor: badgeColor }]}>
        <Ionicons name={icon} size={11} color={badgeTextColor} />
      </View>
      <Text style={styles.corporateContactText} numberOfLines={1}>{value}</Text>
    </View>
  ) : null;

const CorporateLayout = ({ t, name, designation, company, phone, email, website, address }) => {
  const companyWords = (company || '').trim().split(/\s+/).filter(Boolean);
  const companyMain = companyWords[0];
  const companyRest = companyWords.slice(1).join(' ');

  return (
    <View style={styles.corporateBody}>
      <View style={[styles.corporateBar, { backgroundColor: t.accent }]} />
      <View style={styles.corporateContent}>
        <Text style={[styles.name, { color: t.text, fontSize: 18 }]} numberOfLines={1}>{name}</Text>
        {designation ? (
          <View style={styles.corporateRoleRow}>
            <Ionicons name="chevron-forward" size={11} color={t.muted} />
            <Text style={[styles.corporateRole, { color: t.muted }]} numberOfLines={1}>{designation}</Text>
          </View>
        ) : null}
        <View style={styles.corporateContactList}>
          <CorporateContactRow icon="call" value={phone} badgeColor={t.blockColor} badgeTextColor={t.blockText} />
          <CorporateContactRow icon="mail" value={email} badgeColor={t.blockColor} badgeTextColor={t.blockText} />
          <CorporateContactRow
            icon="globe-outline"
            value={website}
            badgeColor={t.blockColor}
            badgeTextColor={t.blockText}
          />
          <CorporateContactRow
            icon="location-outline"
            value={address}
            badgeColor={t.blockColor}
            badgeTextColor={t.blockText}
          />
        </View>
      </View>
      {companyMain ? (
        <View style={styles.corporateLogoRow}>
          <Text style={[styles.corporateLogoMain, { color: t.muted }]}>{companyMain}</Text>
          {companyRest ? (
            <Text style={[styles.corporateLogoSub, { color: t.accent }]}>{companyRest.toUpperCase()}</Text>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.corporateBar, { backgroundColor: t.accent }]} />
    </View>
  );
};

const LAYOUTS = {
  framed: FramedLayout,
  band: BandLayout,
  split: SplitLayout,
  minimal: MinimalLayout,
  corner: CornerLayout,
  ribbon: RibbonLayout,
  circle: CircleLayout,
  dual: DualLayout,
  stacked: StackedLayout,
  bottomBand: BottomBandLayout,
  diagonal: DiagonalLayout,
  corporate: CorporateLayout,
};

// Renders one visiting-card design filled with the given fields. Also used
// as the exact node react-native-view-shot captures to produce the shareable
// image, so this must not depend on anything that only exists on-screen
// (no Pressable states, etc.) - it's a pure, static render of the data.
export const BusinessCardPreview = ({
  templateId,
  name,
  designation,
  company,
  phone,
  email,
  website,
  address,
}) => {
  const t = getCardTemplate(templateId);
  const roleLine = [designation, company].filter(Boolean).join(' at ');
  const Layout = LAYOUTS[t.layout] || FramedLayout;

  return (
    <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <Layout
        t={t}
        name={name || 'Your Name'}
        roleLine={roleLine}
        designation={designation}
        company={company}
        phone={phone}
        email={email}
        website={website}
        address={address}
      />
    </LinearGradient>
  );
};

export { CARD_WIDTH, CARD_HEIGHT };

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
  },
  name: {
    fontSize: 21,
    fontWeight: '700',
  },
  role: {
    fontSize: 13,
    marginTop: 3,
  },
  contactRow: {
    gap: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  contactText: {
    fontSize: 11,
    fontWeight: '500',
  },

  // framed
  frameBorder: {
    flex: 1,
    margin: 14,
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 16,
    justifyContent: 'space-between',
  },
  divider: {
    height: 2,
    width: 44,
    borderRadius: 1,
  },

  // band
  bandBody: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  bandText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // split
  splitRow: {
    flex: 1,
    flexDirection: 'row',
  },
  splitBlock: {
    width: '32%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitBody: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    gap: 6,
  },

  // minimal
  minimalBody: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  minimalIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },

  // corner
  cornerBody: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  cornerTriangle: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 90,
    height: 90,
    borderRadius: 16,
    transform: [{ rotate: '45deg' }],
    opacity: 0.9,
  },
  thinAccent: {
    height: 2,
    width: 36,
    borderRadius: 1,
    marginTop: 6,
  },

  // ribbon
  ribbonBody: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  ribbon: {
    position: 'absolute',
    top: 14,
    right: -34,
    width: 120,
    alignItems: 'center',
    paddingVertical: 4,
    transform: [{ rotate: '35deg' }],
  },
  ribbonText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // circle
  circleBody: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  circleBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInitial: {
    fontSize: 18,
    fontWeight: '800',
  },

  // dual
  dualRow: {
    flex: 1,
    flexDirection: 'row',
  },
  dualLeft: {
    width: '55%',
    padding: 16,
    justifyContent: 'center',
  },
  dualRight: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },

  // stacked
  stackedBody: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  stackedPeek: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    width: 70,
    height: 70,
    borderRadius: 16,
    opacity: 0.18,
    transform: [{ rotate: '12deg' }],
  },

  // bottomBand
  bottomBandBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  bottomBandTop: {
    padding: 18,
  },
  bottomBand: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },

  // diagonal
  diagonalBody: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  diagonalOverlay: {
    position: 'absolute',
    width: 160,
    height: 320,
    top: -70,
    left: -40,
    opacity: 0.35,
    transform: [{ rotate: '25deg' }],
  },

  // corporate
  corporateBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  corporateBar: {
    height: 6,
    width: '26%',
    alignSelf: 'center',
    borderRadius: 3,
  },
  corporateContent: {
    paddingHorizontal: 18,
    paddingTop: 4,
    gap: 4,
  },
  corporateRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  corporateRole: {
    fontSize: 12,
    fontWeight: '700',
  },
  corporateContactList: {
    gap: 4,
    marginTop: 6,
  },
  corporateContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  corporateIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corporateContactText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#374151',
  },
  corporateLogoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  corporateLogoMain: {
    fontSize: 17,
    fontWeight: '800',
  },
  corporateLogoSub: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

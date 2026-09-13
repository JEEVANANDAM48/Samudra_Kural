import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { CoastalGuardNavBar, CGTab } from '../../components/CoastalGuardNavBar';
import { CGDashboardScreen } from './CGDashboardScreen';
import { CGSOSAlertsScreen } from './CGSOSAlertsScreen';
import { CGSOSDetailsScreen } from './CGSOSDetailsScreen';
import { CGCreateMissionScreen } from './CGCreateMissionScreen';
import { CGRescueMissionsScreen } from './CGRescueMissionsScreen';
import { CGMissionDetailsScreen } from './CGMissionDetailsScreen';
import { CGMarineConditionsScreen } from './CGMarineConditionsScreen';
import { CGMarineMapScreen } from './CGMarineMapScreen';
import { CGProfileScreen } from './CGProfileScreen';
import { SOSAlertItem } from '../../services/coastalGuardService';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.82;

interface CoastalGuardHomeScreenProps {
  onLogout: () => void;
  onSwitchToFishermanView: () => void;
}

export const CoastalGuardHomeScreen: React.FC<CoastalGuardHomeScreenProps> = ({
  onLogout,
  onSwitchToFishermanView,
}) => {
  const [activeTab, setActiveTab] = useState<CGTab>('dashboard');
  const [activeSubScreen, setActiveSubScreen] = useState<'main' | 'sos_detail' | 'create_mission' | 'mission_detail' | 'marine_map'>('main');
  const [selectedSOSId, setSelectedSOSId] = useState<number | null>(null);
  const [targetSOSForMission, setTargetSOSForMission] = useState<SOSAlertItem | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const drawerAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;

  const openMenuDrawer = () => {
    setIsDrawerOpen(true);
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeMenuDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setIsDrawerOpen(false);
    });
  };

  const handleOpenSOSDetail = (id: number) => {
    setSelectedSOSId(id);
    setActiveSubScreen('sos_detail');
  };

  const handleOpenCreateMission = (sos: SOSAlertItem) => {
    setTargetSOSForMission(sos);
    setActiveSubScreen('create_mission');
  };

  const handleOpenMissionDetail = (missionId: number) => {
    setSelectedMissionId(missionId);
    setActiveSubScreen('mission_detail');
  };

  const handleMissionCreated = () => {
    setActiveTab('missions');
    setActiveSubScreen('main');
  };

  const isMainScreen = activeSubScreen === 'main';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.cgPrimaryDark} translucent={false} />

      {/* Top Header Banner matching Fisherman HomeScreen layout */}
      {isMainScreen && (
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.appTitle}>SAMUDRA KURAL</Text>
              <Text style={styles.welcomeText}>Welcome, Cmdr. V. Raman!</Text>
              <Text style={styles.appSubtitle}>Coastal Guard Emergency Command HQ</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={openMenuDrawer}
              style={styles.hamburgerButton}
            >
              <Text style={styles.hamburgerIcon}>☰</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Content View Container */}
      <View style={styles.mainContainer}>
        {/* 1. SUB SCREENS (STACK) */}
        {activeSubScreen === 'sos_detail' && selectedSOSId && (
          <CGSOSDetailsScreen
            sosId={selectedSOSId}
            onBack={() => setActiveSubScreen('main')}
            onAssignMission={handleOpenCreateMission}
          />
        )}

        {activeSubScreen === 'create_mission' && targetSOSForMission && (
          <CGCreateMissionScreen
            targetSOS={targetSOSForMission}
            onBack={() => setActiveSubScreen('sos_detail')}
            onMissionCreated={handleMissionCreated}
          />
        )}

        {activeSubScreen === 'mission_detail' && selectedMissionId && (
          <CGMissionDetailsScreen
            missionId={selectedMissionId}
            onBack={() => setActiveSubScreen('main')}
          />
        )}

        {activeSubScreen === 'marine_map' && (
          <CGMarineMapScreen
            onBack={() => setActiveSubScreen('main')}
          />
        )}

        {/* 2. MAIN TAB SCREENS (with hideTopHeader={true}) */}
        {isMainScreen && activeTab === 'dashboard' && (
          <CGDashboardScreen
            hideTopHeader={true}
            onNavigateToSOSList={() => setActiveTab('alerts')}
            onNavigateToSOSDetail={handleOpenSOSDetail}
            onNavigateToMissions={() => setActiveTab('missions')}
            onNavigateToMarineMap={() => setActiveSubScreen('marine_map')}
            onNavigateToMarineData={() => setActiveTab('marine')}
            onOpenProfile={() => setActiveTab('profile')}
          />
        )}

        {isMainScreen && activeTab === 'alerts' && (
          <CGSOSAlertsScreen
            hideTopHeader={true}
            onSelectAlert={handleOpenSOSDetail}
          />
        )}

        {isMainScreen && activeTab === 'missions' && (
          <CGRescueMissionsScreen
            hideTopHeader={true}
            onSelectMission={handleOpenMissionDetail}
          />
        )}

        {isMainScreen && activeTab === 'marine' && (
          <CGMarineConditionsScreen
            hideTopHeader={true}
          />
        )}

        {isMainScreen && activeTab === 'profile' && (
          <CGProfileScreen
            hideTopHeader={true}
            onLogout={onLogout}
            onSwitchToFishermanView={onSwitchToFishermanView}
          />
        )}
      </View>

      {/* FLOATING BOTTOM TAB NAVBAR */}
      {isMainScreen && (
        <CoastalGuardNavBar
          activeTab={activeTab}
          onTabPress={(tab) => {
            setActiveTab(tab);
            setActiveSubScreen('main');
          }}
          activeSOSCount={2}
        />
      )}

      {/* Side Menu Drawer Slide Overlay matching Fisherman HomeScreen */}
      {isDrawerOpen && (
        <View style={StyleSheet.absoluteFill}>
          {/* Backdrop Overlay */}
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={closeMenuDrawer}
          />

          {/* Sliding Menu Drawer */}
          <Animated.View
            style={[
              styles.drawerContainer,
              { transform: [{ translateX: drawerAnim }] },
            ]}
          >
            <SafeAreaView style={{ flex: 1 }}>
              {/* Drawer Header */}
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerHeaderTitle}>Officer Menu & Profile</Text>
                <TouchableOpacity
                  onPress={closeMenuDrawer}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.drawerBody} showsVerticalScrollIndicator={false}>
                {/* Profile Section */}
                <View style={styles.profileSection}>
                  <View style={styles.profileAvatar}>
                    <Text style={styles.avatarText}>👮</Text>
                  </View>

                  <View style={styles.verifiedBadgeDrawer}>
                    <Text style={styles.verifiedBadgeDrawerTxt}>✓ Authorized Coastal Guard</Text>
                  </View>

                  <Text style={styles.profileName}>Cmdr. V. Raman</Text>
                  <Text style={styles.profilePhone}>ID: CG-8841-TN</Text>

                  <TouchableOpacity
                    style={styles.fullProfileDrawerBtn}
                    onPress={() => {
                      closeMenuDrawer();
                      setActiveTab('profile');
                    }}
                  >
                    <Text style={styles.fullProfileDrawerBtnTxt}>
                      View Officer Command Profile
                    </Text>
                  </TouchableOpacity>

                  {/* Official Coastal Guard Officer Specs List */}
                  <View style={{ width: '100%', marginTop: 12 }}>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Emergency Hotline:</Text>
                      <Text style={styles.infoBoxValueHighlight}>+91 44 2345 6789</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Command Station:</Text>
                      <Text style={styles.infoBoxValue}>Chennai HQ Base</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Service Badge ID:</Text>
                      <Text style={styles.infoBoxValueBadge}>CG-8841-TN</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Clearance Level:</Text>
                      <Text style={styles.infoBoxValue}>Level 5 Master Command</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Patrol Vessel Unit:</Text>
                      <Text style={styles.infoBoxValue}>ICGS Samudra Paheredar</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Officer License No:</Text>
                      <Text style={styles.infoBoxValue}>ICG-IND-2024-88410</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Officer Gov Aadhaar:</Text>
                      <Text style={styles.infoBoxValue}>XXXX-XXXX-8841</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>Base HQ Address:</Text>
                      <Text style={styles.infoBoxValue}>Ennore High Road, Chennai</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoBoxLabel}>HQ Pincode:</Text>
                      <Text style={styles.infoBoxValue}>600009</Text>
                    </View>
                  </View>
                </View>

                {/* Drawer Actions */}
                <View style={styles.drawerActions}>
                  <TouchableOpacity
                    style={styles.switchRoleBtn}
                    onPress={() => {
                      closeMenuDrawer();
                      onSwitchToFishermanView();
                    }}
                  >
                    <Text style={styles.switchRoleTxt}>🎣 Switch to Fisherman App View</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.logoutBtn}
                    onPress={() => {
                      closeMenuDrawer();
                      onLogout();
                    }}
                  >
                    <Text style={styles.logoutTxt}>🔒 Officer Logout</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.cgPrimaryDark,
  },
  header: {
    backgroundColor: Colors.cgPrimaryDark,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 6 : 10,
    paddingBottom: 12,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    marginRight: 10,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  welcomeText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.cgSecondary,
    marginBottom: 1,
  },
  appSubtitle: {
    fontSize: 12,
    color: '#93C5FD',
    fontWeight: '600',
  },
  hamburgerButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  hamburgerIcon: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.cgBackground,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  drawerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
  },
  drawerHeaderTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.textSecondary,
  },
  drawerBody: {
    paddingVertical: 18,
  },
  profileSection: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.cgPrimary,
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 32,
  },
  verifiedBadgeDrawer: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  verifiedBadgeDrawerTxt: {
    color: Colors.cgPrimary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  fullProfileDrawerBtn: {
    backgroundColor: Colors.cgPrimary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  fullProfileDrawerBtnTxt: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  infoBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoBoxLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  infoBoxValue: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '700',
  },
  infoBoxValueBadge: {
    fontSize: 11,
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  infoBoxValueHighlight: {
    fontSize: 12,
    color: Colors.cgCritical,
    fontWeight: 'bold',
  },
  drawerActions: {
    gap: 10,
  },
  drawerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  drawerActionIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  drawerActionTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  switchRoleBtn: {
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#93C5FD',
    alignItems: 'center',
    marginTop: 6,
  },
  switchRoleTxt: {
    color: Colors.cgPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  logoutBtn: {
    backgroundColor: '#FEF2F2',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
  },
  logoutTxt: {
    color: Colors.cgCritical,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

import React from 'react';
import { StyleSheet, TouchableOpacity, Modal, View as RNView, Pressable } from 'react-native';
import { Text } from '@/components/Themed';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

interface AccountMenuProps {
  visible: boolean;
  onClose: () => void;
  onSignOut: () => void;
  userInitial: string;
}

export default function AccountMenu({ visible, onClose, onSignOut, userInitial }: AccountMenuProps) {
  const handleSettings = () => {
    onClose();
    router.push('/account-settings');
  };

  const handleSignOut = () => {
    onClose();
    onSignOut();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <RNView style={styles.menuContainer}>
          <LinearGradient colors={['#2d2d44', '#1f1f2e']} style={styles.menu}>
            {/* User avatar header */}
            <RNView style={styles.header}>
              <RNView style={styles.avatarLarge}>
                <Text style={styles.avatarText}>{userInitial}</Text>
              </RNView>
            </RNView>

            {/* Menu items */}
            <TouchableOpacity style={styles.menuItem} onPress={handleSettings}>
              <Text style={styles.menuIcon}>⚙️</Text>
              <Text style={styles.menuText}>Account Settings</Text>
            </TouchableOpacity>

            <RNView style={styles.divider} />

            <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
              <Text style={styles.menuIcon}>🚪</Text>
              <Text style={[styles.menuText, styles.signOutText]}>Sign Out</Text>
            </TouchableOpacity>
          </LinearGradient>
        </RNView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 80,
    paddingRight: 20,
  },
  menuContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menu: {
    minWidth: 200,
    padding: 8,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    marginBottom: 8,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  signOutText: {
    color: '#ef4444',
  },
  divider: {
    height: 1,
    backgroundColor: '#374151',
    marginVertical: 4,
  },
});

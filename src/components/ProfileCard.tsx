import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useTerminal } from '../context/TerminalContext';
import { CabalAlignment } from '../types';

const { width } = Dimensions.get('window');

export default function ProfileCard(): React.JSX.Element {
  const { alignment, theme, profile, updateCabalAlignment } = useTerminal();
  const credentials = profile.operative_profile.credentials;
  const vectors = profile.operative_profile.location_vectors;
  const currencies = profile.operative_profile.payload_manifest.currencies;

  const cabals: CabalAlignment[] = ['TERRAN_GRID', 'LEGION', 'SOLARIS'];

  return (
    <View style={[styles.cardContainer, { backgroundColor: theme.backgroundColor, borderColor: theme.borderColor }]}>
      
      {/* Header Security Clearance Log */}
      <View style={[styles.headerBanner, { borderColor: theme.borderColor }]}>
        <Text style={[styles.bootText, { color: theme.primaryColor }]} numberOfLines={2}>
          {theme.bootLog}
        </Text>
      </View>

      {/* Main Identity Manifest */}
      <View style={styles.manifestBody}>
        <View style={styles.metaRow}>
          <Text style={[styles.label, { color: theme.mutedColor }]}>OPERATIVE_ID:</Text>
          <Text style={[styles.value, { color: theme.primaryColor }]}>{credentials.id}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={[styles.label, { color: theme.mutedColor }]}>HANDLE:</Text>
          <Text style={[styles.value, { color: theme.primaryColor }]}>{credentials.username}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={[styles.label, { color: theme.mutedColor }]}>CLASS_BLUEPRINT:</Text>
          <Text style={[styles.value, { color: theme.primaryColor }]}>{credentials.class}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={[styles.label, { color: theme.mutedColor }]}>CURRENT_NODE:</Text>
          <Text style={[styles.value, { color: theme.primaryColor }]}>{vectors.current_node_lock}</Text>
        </View>
      </View>

      {/* Ledger Manifest / Payload Quantities */}
      <View style={[styles.ledgerSection, { backgroundColor: theme.backgroundColor === '#000000' ? '#111111' : 'transparent', borderColor: theme.borderColor }]}>
        <Text style={[styles.sectionTitle, { color: theme.mutedColor }]}>PAYLOAD_MANIFEST // VALUE_QUANTITIES</Text>
        
        <View style={styles.gridRow}>
          <View style={styles.gridItem}>
            <Text style={[styles.gridLabel, { color: theme.mutedColor }]}>GLIMMER</Text>
            <Text style={[styles.gridValue, { color: theme.primaryColor }]}>{currencies.crypto_glimmer}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={[styles.gridLabel, { color: theme.mutedColor }]}>TRIBUTES</Text>
            <Text style={[styles.gridValue, { color: theme.primaryColor }]}>{currencies.cabal_tributes}</Text>
          </View>
        </View>
      </View>

      {/* Alignment Calibration Interface */}
      <View style={styles.interfaceControls}>
        <Text style={[styles.controlLabel, { color: theme.mutedColor }]}>CALIBRATE_ALIGNMENT_FREQUENCY:</Text>
        <View style={styles.buttonTrack}>
          {cabals.map((cabal) => {
            const isActive = alignment === cabal;
            return (
              <TouchableOpacity
                key={cabal}
                onPress={() => updateCabalAlignment(cabal)}
                activeOpacity={0.8}
                style={[
                  styles.cabalButton,
                  { borderColor: theme.borderColor },
                  isActive && { backgroundColor: theme.borderColor }
                ]}
              >
                <Text 
                  style={[
                    styles.buttonText, 
                    { color: isActive ? theme.primaryColor : theme.mutedColor }
                  ]}
                >
                  {cabal.split('_')[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: width - 32,
    alignSelf: 'center',
    borderWidth: 2,
    padding: 16,
    // Eliminates web layout risks by establishing rigid layout parameters
    minHeight: 380,
    justifyContent: 'space-between',
  },
  headerBanner: {
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 16,
  },
  bootText: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 0.5,
    lineHeight: 14,
  },
  manifestBody: {
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
  },
  value: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  ledgerSection: {
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'monospace',
    fontSize: 10,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridItem: {
    flex: 1,
  },
  gridLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
  },
  gridValue: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
  },
  interfaceControls: {
    marginTop: 8,
  },
  controlLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    marginBottom: 6,
  },
  buttonTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  cabalButton: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
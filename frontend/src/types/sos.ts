export type SOSStatus = 
  | 'idle'
  | 'getting_location'
  | 'checking_connection'
  | 'sending'
  | 'pending'
  | 'active'
  | 'cancelling'
  | 'cancelled'
  | 'error';

export type EmergencyType = 
  | 'General Emergency'
  | 'Boat problem'
  | 'Medical emergency'
  | 'Bad weather'
  | 'Navigation problem'
  | 'Net / fishing gear problem'
  | 'Other';

export type CommunicationStatus = 'online' | 'offline';

export interface LocationResult {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: string;
  available: boolean;
  errorMessage?: string;
}

export interface SOSPacket {
  id: string;
  boatId: string;
  userId: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: string;
  emergencyType: EmergencyType;
  batteryLevel: number;
  communicationStatus: CommunicationStatus;
  status: 'pending' | 'active' | 'cancelled';
  rescueStationRouted?: string;
}

export interface MockSendResult {
  success: boolean;
  referenceId: string;
  timestamp: string;
  message?: string;
}

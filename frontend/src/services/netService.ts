import { apiFetch } from './api';
import {
  FishingNet,
  CreateNetPayload,
  TrajectoryResponse,
  EnvironmentalState,
  EnvironmentTestResponse
} from '../types/net';

export async function fetchAllNets(): Promise<FishingNet[]> {
  return await apiFetch<FishingNet[]>('/nets');
}

export async function fetchActiveNets(): Promise<FishingNet[]> {
  return await apiFetch<FishingNet[]>('/nets/active');
}

export async function fetchNetDetails(id: number): Promise<FishingNet & { trajectory: TrajectoryResponse; current_environment: EnvironmentalState }> {
  return await apiFetch<FishingNet & { trajectory: TrajectoryResponse; current_environment: EnvironmentalState }>(`/nets/${id}`);
}

export async function createFishingNet(payload: CreateNetPayload): Promise<FishingNet> {
  return await apiFetch<FishingNet>('/nets', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function regeneratePrediction(id: number): Promise<TrajectoryResponse> {
  return await apiFetch<TrajectoryResponse>(`/nets/${id}/predict`, {
    method: 'POST',
  });
}

export async function fetchNetTrajectory(id: number): Promise<TrajectoryResponse> {
  return await apiFetch<TrajectoryResponse>(`/nets/${id}/trajectory`);
}

export async function fetchNetEnvironment(id: number): Promise<EnvironmentalState> {
  return await apiFetch<EnvironmentalState>(`/nets/${id}/environment`);
}

export async function deleteNet(id: number): Promise<{ message: string }> {
  return await apiFetch<{ message: string }>(`/nets/${id}`, {
    method: 'DELETE',
  });
}

export async function testOceanEnvironment(
  latitude: number,
  longitude: number,
  targetTime?: string
): Promise<EnvironmentTestResponse> {
  let url = `/environment/test?latitude=${latitude}&longitude=${longitude}`;
  if (targetTime) {
    url += `&datetime=${encodeURIComponent(targetTime)}`;
  }
  return await apiFetch<EnvironmentTestResponse>(url);
}

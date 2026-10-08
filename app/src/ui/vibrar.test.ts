import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { vibrar } from './vibrar';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()), notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'leve' }, NotificationFeedbackType: { Success: 'sucesso' },
}));

afterEach(() => jest.restoreAllMocks());
it('não chama vibração na web', () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  vibrar.leve(); vibrar.sucesso();
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
  expect(Haptics.notificationAsync).not.toHaveBeenCalled();
});
it('usa feedback leve e sucesso no celular', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  vibrar.leve(); vibrar.sucesso();
  expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
});

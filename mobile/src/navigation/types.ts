/** Navigation type definitions */

export type HomeStackParamList = {
  Home: undefined;
  SpotDetail: { spotId: string; spotName: string };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  CompareTab: undefined;
  AlertsTab: undefined;
  ProfileTab: undefined;
};

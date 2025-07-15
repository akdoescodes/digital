declare module '@react-three/fiber' {
  export interface RootState {
    clock: {
      elapsedTime: number;
    };
  }
  
  export function useFrame(callback: (state: RootState) => void): void;
  export function useThree(): {
    gl: any;
    scene: any;
    camera: any;
  };
  export function Canvas(props: any): JSX.Element;
}

declare module '@react-three/drei' {
  export function Text(props: any): JSX.Element;
  export function Box(props: any): JSX.Element;
  export function Plane(props: any): JSX.Element;
}

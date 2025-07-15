import * as React from 'react';
import * as THREE from 'three';

declare module '@react-three/fiber' {
  export interface RootState {
    clock: {
      elapsedTime: number;
    };
  }
  
  export function useFrame(callback: (state: RootState) => void): void;
  export function useThree(): {
    gl: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
  };
  export function Canvas(props: React.PropsWithChildren<unknown>): JSX.Element;
}

declare module '@react-three/drei' {
  export function Text(props: React.PropsWithChildren<unknown>): JSX.Element;
  export function Box(props: React.PropsWithChildren<unknown>): JSX.Element;
  export function Plane(props: React.PropsWithChildren<unknown>): JSX.Element;
}

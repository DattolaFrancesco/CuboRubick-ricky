import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Compiler disattivato: il reconciler custom di @react-three/fiber e le
  // mutazioni dirette sugli oggetti Three.js (ref, useFrame) non vanno d'accordo
  // con la memoizzazione automatica del compiler.
  reactCompiler: false,
};

export default nextConfig;

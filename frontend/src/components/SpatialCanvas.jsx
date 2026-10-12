import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';

function FloatingDiamondCore() {
  const meshRef = useRef();

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.35;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.4) * 0.2;
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1.5}>
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <octahedronGeometry args={[2.2, 0]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          roughness={0.08}
          metalness={0.15}
          transmission={0.88}
          ior={2.42} // Real Diamond Index of Refraction
          thickness={1.5}
          specularIntensity={1.2}
          wireframe={false}
          emissive="#0284c7"
          emissiveIntensity={0.25}
          transparent={true}
          opacity={0.85}
        />
      </mesh>
    </Float>
  );
}

function SecurityRings() {
  const ring1 = useRef();
  const ring2 = useRef();

  useFrame((state, delta) => {
    if (ring1.current) ring1.current.rotation.z += delta * 0.15;
    if (ring2.current) ring2.current.rotation.x -= delta * 0.2;
  });

  return (
    <>
      <mesh ref={ring1} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[3.4, 0.025, 16, 100]} />
        <meshStandardMaterial color="#818cf8" emissive="#818cf8" emissiveIntensity={0.6} transparent opacity={0.6} />
      </mesh>
      <mesh ref={ring2} rotation={[0, Math.PI / 4, 0]}>
        <torusGeometry args={[4.2, 0.02, 16, 100]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.5} transparent opacity={0.5} />
      </mesh>
    </>
  );
}

function SpatialParticleField({ count = 160 }) {
  const points = useMemo(() => {
    const coords = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      coords[i * 3] = (Math.random() - 0.5) * 24;
      coords[i * 3 + 1] = (Math.random() - 0.5) * 16;
      coords[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    return coords;
  }, [count]);

  const pointsRef = useRef();

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.04;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[points, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#a78bfa"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

export default function SpatialCanvas() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <Canvas
        camera={{ position: [0, 0, 7.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} color="#38bdf8" />
        <pointLight position={[-8, -8, -5]} intensity={1.8} color="#c084fc" />
        <pointLight position={[0, 4, 2]} intensity={2.2} color="#38bdf8" />

        <FloatingDiamondCore />
        <SecurityRings />
        <SpatialParticleField count={220} />
      </Canvas>

      {/* Subtle Spatial Horizon Glow */}
      <div className="absolute inset-0 bg-radial-[at_50%_40%] from-transparent via-[#070b14]/70 to-[#05070d] pointer-events-none" />
    </div>
  );
}

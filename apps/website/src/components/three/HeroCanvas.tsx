"use client";

import { OrbitControls, Sphere } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import type { PointLight } from "three";

function AnimatedSphere() {
	return (
		<Sphere args={[1, 32, 32]} position={[0, 0, 0]}>
			<meshStandardMaterial
				color="#1a1a1a"
				roughness={0.1}
				metalness={1}
				wireframe={false}
			/>
		</Sphere>
	);
}

function MouseLight() {
	const lightRef = useRef<PointLight>(null);

	useFrame((state) => {
		if (lightRef.current) {
			// Get mouse position from state (normalized -1 to 1)
			const x = state.mouse.x * 5;
			const y = state.mouse.y * 5;
			// Position light behind the sphere (negative Z)
			lightRef.current.position.set(x, y, -3);
		}
	});

	return (
		<pointLight ref={lightRef} intensity={2} color="#ffffff" distance={10} />
	);
}

interface HeroCanvasProps {
	className?: string;
}

export function HeroCanvas({ className }: HeroCanvasProps) {
	return (
		<div className={className}>
			<Canvas
				camera={{ position: [0, 0, 5], fov: 45 }}
				style={{ background: "#000000" }}
			>
				<Suspense fallback={null}>
					<ambientLight intensity={0.2} />
					<MouseLight />
					<pointLight position={[3, 3, 3]} intensity={0.5} />
					<AnimatedSphere />
					<OrbitControls
						enableZoom={false}
						enablePan={false}
						autoRotate
						autoRotateSpeed={1}
					/>
				</Suspense>
			</Canvas>
		</div>
	);
}

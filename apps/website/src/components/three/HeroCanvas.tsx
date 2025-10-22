"use client";

import { OrbitControls, Sphere } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";

function AnimatedSphere() {
	return (
		<Sphere args={[1, 32, 32]} position={[0, 0, 0]}>
			<meshStandardMaterial
				color="#8b5cf6"
				roughness={0.3}
				metalness={0.7}
				wireframe={false}
			/>
		</Sphere>
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
				style={{ background: "transparent" }}
			>
				<Suspense fallback={null}>
					<ambientLight intensity={0.5} />
					<directionalLight position={[10, 10, 5]} intensity={1} />
					<pointLight position={[-10, -10, -5]} intensity={0.5} />
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

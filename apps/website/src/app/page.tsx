import { Button } from "@superset/ui/button";
import { Card } from "@superset/ui/card";
import { FadeUp } from "@/components/motion/FadeUp";
import { HeroParallax } from "@/components/motion/HeroParallax";
import { TiltCard } from "@/components/motion/TiltCard";
import { HeroCanvas } from "@/components/three/HeroCanvas";

export default function Home() {
	return (
		<main className="flex min-h-screen flex-col">
			{/* Hero Section with Parallax */}
			<HeroParallax className="relative min-h-screen flex items-center justify-center overflow-hidden">
				{/* Optional 3D Background */}
				<div className="absolute inset-0 z-0">
					<HeroCanvas className="w-full h-full" />
					<div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
				</div>

				{/* Hero Content */}
				<div className="relative z-10 px-8 text-center">
					<FadeUp>
						<h1 className="text-6xl font-bold mb-6">Welcome to Superset</h1>
					</FadeUp>
					<FadeUp delay={0.2}>
						<p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
							Experience clean, extensible 3D and motion-based UI interactions
							built with Framer Motion and React Three Fiber.
						</p>
					</FadeUp>
					<FadeUp delay={0.4}>
						<div className="flex gap-4 justify-center">
							<Button size="lg">Get Started</Button>
							<Button size="lg" variant="outline">
								Learn More
							</Button>
						</div>
					</FadeUp>
				</div>
			</HeroParallax>

			{/* Feature Cards Section */}
			<section className="py-24 px-8 bg-background">
				<div className="max-w-7xl mx-auto">
					<FadeUp>
						<h2 className="text-4xl font-bold text-center mb-16">
							Interactive Features
						</h2>
					</FadeUp>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						<FadeUp delay={0.1}>
							<TiltCard>
								<Card className="p-8 h-full hover:shadow-2xl transition-shadow">
									<h3 className="text-2xl font-semibold mb-4">Framer Motion</h3>
									<p className="text-muted-foreground">
										Smooth, production-ready animations for hover,
										scroll-reveal, and route transitions. DOM-based for optimal
										performance.
									</p>
								</Card>
							</TiltCard>
						</FadeUp>

						<FadeUp delay={0.2}>
							<TiltCard>
								<Card className="p-8 h-full hover:shadow-2xl transition-shadow">
									<h3 className="text-2xl font-semibold mb-4">
										React Three Fiber
									</h3>
									<p className="text-muted-foreground">
										Optional lightweight 3D elements for hero sections and
										product showcases. WebGL-powered visual depth.
									</p>
								</Card>
							</TiltCard>
						</FadeUp>

						<FadeUp delay={0.3}>
							<TiltCard>
								<Card className="p-8 h-full hover:shadow-2xl transition-shadow">
									<h3 className="text-2xl font-semibold mb-4">
										Clean Architecture
									</h3>
									<p className="text-muted-foreground">
										Composable, maintainable components. 95% DOM-based
										interactions with strategic 3D enhancements.
									</p>
								</Card>
							</TiltCard>
						</FadeUp>
					</div>
				</div>
			</section>

			{/* Additional Content Section */}
			<section className="py-24 px-8">
				<div className="max-w-4xl mx-auto">
					<FadeUp>
						<Card className="p-12">
							<h2 className="text-3xl font-bold mb-6">Built for Performance</h2>
							<p className="text-muted-foreground text-lg mb-4">
								Our approach prioritizes maintainability and performance. By
								keeping 95% of interactions DOM-based with Framer Motion, we
								ensure fast load times and smooth animations across all devices.
							</p>
							<p className="text-muted-foreground text-lg">
								Strategic use of React Three Fiber adds visual depth where it
								matters most, without compromising performance or accessibility.
							</p>
						</Card>
					</FadeUp>
				</div>
			</section>
		</main>
	);
}

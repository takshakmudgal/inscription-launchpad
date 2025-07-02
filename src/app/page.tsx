"use client";

import Image from "next/image";
import { BlockCarousel } from "~/components/BlockCarousel";

export default function PlaceholderPage() {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--background)",
        }}
      >
        <div className="container mx-auto flex h-16 items-center justify-between space-x-20 px-4 sm:h-20 sm:px-6 md:justify-center lg:px-8">
          <div className="flex items-center">
            <Image
              src="/bitmemes_logo.png"
              alt="BitPill Logo"
              width={24}
              height={24}
              className="sm:h-8 sm:w-8"
              style={{ objectFit: "contain" }}
            />
            <span
              className="text-lg font-bold sm:text-xl"
              style={{ color: "var(--foreground)" }}
            >
              BitPill
            </span>
          </div>
          <a
            href="https://x.com/bitpilldotfun"
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-bold sm:text-xl"
            style={{ color: "var(--foreground)" }}
          >
            <Image
              src="/x_white.png"
              alt="X Logo"
              width={24}
              height={24}
              className="sm:h-6 sm:w-6"
              style={{ objectFit: "contain" }}
            />
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto flex flex-col items-center justify-center px-4 py-10 text-center sm:py-20">
          <div className="flex w-full flex-col items-center justify-center gap-8 md:flex-row md:gap-16">
            {/* Bitcoin Part */}
            <div className="flex flex-col items-center gap-4">
              <Image
                src="/btc_logo.svg"
                alt="Bitcoin Logo"
                width={100}
                height={100}
                className="sm:h-36 sm:w-36"
              />
              <h2
                className="text-2xl font-bold sm:text-3xl"
                style={{ color: "var(--primary)" }}
              >
                Inscribe on Bitcoin <span className="italic">Forever</span>
              </h2>
            </div>

            {/* Plus Sign */}
            <div className="my-2 text-4xl font-thin text-gray-500 sm:my-4 md:my-0 md:text-6xl">
              +
            </div>

            {/* Solana Part */}
            <div className="flex flex-col items-center gap-4">
              <Image
                src="/solana_logo.png"
                alt="Solana Logo"
                width={100}
                height={100}
                className="sm:h-36 sm:w-36"
                style={{ objectFit: "contain" }}
              />
              <h2
                className="text-2xl font-bold sm:text-3xl"
                style={{ color: "#9945FF" }}
              >
                Launch on Solana
              </h2>
            </div>
          </div>

          {/* <p className="mt-12 max-w-3xl text-base text-gray-300 sm:mt-16 sm:text-lg">
            The ultimate battleground for memes. Propose, vote, and get your
            meme inscribed on Bitcoin and launched as a token on Solana.
          </p> */}
        </section>

        <div className="container mx-auto">
          <BlockCarousel onLatestBlock={() => {}} />
        </div>

        {/* How It Works Section */}
        <section className="container mx-auto px-4 py-16 sm:py-24 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold sm:mb-20 sm:text-4xl">
            How It Works
          </h2>
          <div className="relative">
            <div
              className="absolute top-6 bottom-6 left-1/2 -ml-px hidden w-0.5 bg-gray-700 md:block"
              style={{ backgroundColor: "var(--border)" }}
            ></div>
            <div className="space-y-16 md:space-y-0">
              <HowItWorksStep
                step="1"
                title="Submit Your Meme"
                description="Connect your wallet and submit a meme to join the current competition block."
                isLeft={true}
              />
              <HowItWorksStep
                step="2"
                title="Community Voting"
                description="The community votes on all submissions. The meme with the most votes wins the block."
                isLeft={false}
              />
              <HowItWorksStep
                step="3"
                title="Winner Inscribed"
                description="The winning meme is permanently inscribed onto the Bitcoin blockchain as an Ordinal."
                isLeft={true}
              />
              <HowItWorksStep
                step="4"
                title="Launch on Pump.fun"
                description="Launch your winning meme as a new token on Solana."
                isLeft={false}
              />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="container mx-auto flex items-center justify-between px-4 py-6 text-gray-400 sm:px-6 lg:px-8">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} BitPill. All rights reserved.
          </p>
          <p className="text-sm">The future of memes is eternal.</p>
        </div>
      </footer>
    </div>
  );
}

function HowItWorksStep({
  step,
  title,
  description,
  isLeft,
}: {
  step: string;
  title: string;
  description: string;
  isLeft: boolean;
}) {
  const StepContent = () => (
    <div className="w-full md:w-5/12">
      <div className={`p-4 ${isLeft ? "md:text-right" : "md:text-left"}`}>
        <h3
          className="mb-2 text-xl font-bold sm:text-2xl"
          style={{ color: "var(--primary)" }}
        >
          {title}
        </h3>
        <p className="text-sm text-gray-300 sm:text-base">{description}</p>
      </div>
    </div>
  );

  const StepCircle = () => (
    <div
      className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold sm:h-12 sm:w-12 sm:text-xl"
      style={{ backgroundColor: "var(--primary)", color: "var(--background)" }}
    >
      {step}
    </div>
  );

  return (
    <div className="flex flex-col items-center md:mb-16 md:flex-row">
      {/* Mobile Layout */}
      <div
        className="block w-full border-l-4 pl-4 md:hidden"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="mb-2 flex items-center gap-4">
          <StepCircle />
          <h3
            className="text-xl font-bold sm:text-2xl"
            style={{ color: "var(--primary)" }}
          >
            {title}
          </h3>
        </div>
        <p className="text-sm text-gray-300 sm:text-base">{description}</p>
      </div>

      {/* Desktop Layout */}
      <div className="hidden w-full items-center justify-between md:flex">
        {isLeft ? <StepContent /> : <div className="w-5/12"></div>}
        <StepCircle />
        {!isLeft ? <StepContent /> : <div className="w-5/12"></div>}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { HowThisWorks } from "../_components/HowThisWorks";

export const metadata: Metadata = {
  title: "How Verdé works",
  description:
    "Our honesty promise: AI parses your words, a deterministic calculator computes every CO₂e, and every number is sourced.",
};

export default function HowItWorksPage() {
  return <HowThisWorks />;
}

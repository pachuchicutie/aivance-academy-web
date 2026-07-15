import Header from "@/components/Header";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Challenge from "@/components/Challenge";
import Learn from "@/components/Learn";
import Schedule from "@/components/Schedule";
import Skills from "@/components/Skills";
import WhoFor from "@/components/WhoFor";
import Output from "@/components/Output";
import Pricing from "@/components/Pricing";
import FinalCta from "@/components/FinalCta";
import Footer from "@/components/Footer";
import RedirectIfAuthed from "@/components/RedirectIfAuthed";

/** Refresh seat counts periodically without full static freeze. */
export const revalidate = 30;

export default function Home() {
  return (
    <RedirectIfAuthed>
      <Header />
      <main>
        <Hero />
        <About />
        <Challenge />
        <Learn />
        <Schedule />
        <Skills />
        <WhoFor />
        <Output />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </RedirectIfAuthed>
  );
}

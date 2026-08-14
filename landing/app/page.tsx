import { SiteHeader } from '@/components/site-header'
import { Ticker } from '@/components/ticker'
import { Hero } from '@/components/hero'
import { Manifesto } from '@/components/manifesto'
import { Features } from '@/components/features'
import { HowItWorks } from '@/components/how-it-works'
import { Metrics } from '@/components/metrics'
import { Changelog } from '@/components/changelog'
import { FinalCta } from '@/components/final-cta'
import { SiteFooter } from '@/components/site-footer'

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main>
        <Ticker />
        <Hero />
        <Manifesto />
        <Features />
        <HowItWorks />
        <Metrics />
        <Changelog />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  )
}

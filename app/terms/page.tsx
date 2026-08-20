"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Scale } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

function TermsOfServiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from"); // "onboarding" → show Accept button

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-sm mb-4 overflow-hidden">
            <Logo size={64} />
          </div>
          <h1 className="font-display text-3xl text-zff-black tracking-wider">TERMS OF SERVICE</h1>
          <p className="text-sm text-muted-foreground mt-2">Zim Fantasy Football — Effective 29 May 2026</p>
        </div>

        {/* Disclaimer banner — the platform's independence is the single most
            important thing a new user needs to see before anything else. */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6 text-sm text-amber-900 leading-relaxed">
          <p className="font-bold mb-1">Independent fan platform — not affiliated with any club or league</p>
          <p>
            Zim Fantasy Football is an independent fantasy sports platform created for football fans. It is not
            affiliated with, endorsed by, or officially connected to ZIFA, the Premier Soccer League, or any
            participating football club. All third-party names and references are used solely to identify
            real-world football teams and players where legally permitted.
          </p>
        </div>

        {/* Terms card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 sm:p-10 space-y-8 text-sm text-slate-700 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3 flex items-center gap-2">
              <Scale className="w-4 h-4 text-zff-green shrink-0" /> 1. Acceptance of Terms
            </h2>
            <p>
              These Terms of Service ("<strong>Terms</strong>") govern your access to and use of Zim Fantasy Football
              (the "<strong>Platform</strong>"), operated by <strong>OMNI Global</strong> ("<strong>we</strong>",
              "<strong>us</strong>", "<strong>our</strong>"). By creating an account or using the Platform, you agree
              to be bound by these Terms and by our Privacy Policy. If you do not agree, do not use the Platform.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">2. Nature of the Platform</h2>
            <p className="mb-3">
              Zim Fantasy Football is a fan-made fantasy football game covering clubs across Zimbabwe. It is:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Not affiliated with, endorsed by, sponsored by, or officially connected to ZIFA, the Premier Soccer League, or any real football club.</li>
              <li>Built around original branding, scoring rules, and content — it does not use official club crests, kits, or copyrighted media.</li>
              <li>Free to enter. There is no pay-to-play entry fee, and the Platform does not operate any pooled-stake or betting mechanic.</li>
              <li>Funded by advertising and sponsorships; any prizes offered are provided or funded by sponsors, not paid out of user entry fees, because none are collected.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">3. Eligibility &amp; Accounts</h2>
            <p className="mb-3">
              You must be at least 16 years old to create an account. You are responsible for maintaining the
              confidentiality of your login credentials and for all activity that occurs under your account. Notify
              us immediately if you suspect unauthorised access to your account.
            </p>
            <p>
              We may suspend or terminate accounts that provide false information, are used to abuse or exploit the
              Platform, or that otherwise violate these Terms.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">4. Fantasy Game Rules</h2>
            <p className="mb-3">
              Users build a fantasy squad from players across participating clubs, subject to a fixed budget and
              squad-size rules enforced by the Platform. Points are awarded automatically based on real-world match
              events (goals, assists, clean sheets, cards, and minutes played) as recorded by Platform administrators.
              Scoring rules are published in-app and may be adjusted between seasons; material changes will be
              announced in advance where practicable.
            </p>
            <p>
              Fantasy standings are for entertainment purposes. The Platform does not accept monetary entry fees, does
              not operate as a bookmaker, and no feature of the Platform constitutes gambling or betting as defined
              under Zimbabwean law.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">5. Prizes &amp; Sponsorship</h2>
            <p>
              Where prizes are offered (for example, for public league winners or promotional competitions), they are
              provided or funded by sponsors and described on the relevant league or promotion page. Prize
              availability, value, and eligibility rules are set at our discretion and may vary by promotion. Because
              entry is free, prize eligibility is never conditioned on payment.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">6. Intellectual Property</h2>
            <p className="mb-3">
              The Platform's branding, design, software, and original content are owned by OMNI Global or its
              licensors. You may not copy, reproduce, or redistribute Platform content without permission.
            </p>
            <p>
              Any real club or player names that appear on the Platform (for example, in fixtures or news references)
              are used solely to identify real-world teams and events, consistent with fair-use / nominative-use
              principles, and are not used to imply sponsorship or endorsement. If a rights holder believes any
              content on the Platform infringes their trademark or copyright, contact us using the details in Section
              12 and we will review and, where appropriate, remove the content.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">7. User Conduct</h2>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Do not attempt to manipulate scoring, exploit bugs, or use automated tools to gain an unfair advantage.</li>
              <li>Do not post abusive, discriminatory, or unlawful content in community chat or league features.</li>
              <li>Do not impersonate another person, club, or organisation.</li>
              <li>Do not attempt to access another user's account or data without authorisation.</li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">8. Disclaimer of Warranties</h2>
            <p>
              The Platform is provided "as is" and "as available" without warranties of any kind, whether express or
              implied. We do not warrant that the Platform will be uninterrupted, error-free, or that match statistics
              will always be entered without delay or error. Fantasy points and standings are informational and are
              not a substitute for official match records.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, OMNI Global shall not be liable for any indirect, incidental, or
              consequential damages arising from your use of the Platform. Our total liability for any claim relating
              to the Platform shall not exceed the amount you have paid us in the twelve months preceding the claim
              (which, given free entry, will typically be zero).
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">10. Termination</h2>
            <p>
              You may stop using the Platform and request account deletion at any time. We may suspend or terminate
              your access for violation of these Terms, at our discretion, with or without notice where warranted by
              the severity of the violation.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">11. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Changes will be posted on this page with a revised
              effective date. Continued use of the Platform after changes are posted constitutes acceptance of the
              updated Terms.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">12. Contact</h2>
            <p>For questions about these Terms, contact OMNI Global at:</p>
            <address className="not-italic mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm space-y-1">
              <p><strong>OMNI Global</strong></p>
              <p>Zim Fantasy Football — Legal</p>
              <p>Email: <a href="mailto:legal@omniglobal.one" className="text-zff-green hover:underline">legal@omniglobal.one</a></p>
            </address>
          </section>

          {/* Governing law */}
          <p className="text-xs text-muted-foreground border-t border-slate-200 pt-6">
            These Terms are governed by the laws of Zimbabwe. Any disputes shall be subject to the exclusive
            jurisdiction of the courts of Zimbabwe.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          {from === "onboarding" ? (
            <>
              <p className="text-xs text-muted-foreground">
                By clicking &ldquo;Accept &amp; Continue&rdquo; you confirm you have read and agree to these Terms.
              </p>
              <button
                onClick={() => router.push("/onboarding")}
                className="btn-primary text-sm px-6 py-2.5 shrink-0"
              >
                Accept &amp; Continue
              </button>
            </>
          ) : (
            <Link href="/" className="text-sm text-zff-green hover:underline font-medium">&larr; Back to home</Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TermsOfServicePage() {
  return (
    <Suspense fallback={null}>
      <TermsOfServiceContent />
    </Suspense>
  );
}

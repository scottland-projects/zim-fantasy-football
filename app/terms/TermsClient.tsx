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
          <p className="text-sm text-muted-foreground mt-2">Africa Fantasy • Effective 29 May 2026</p>
        </div>

        {/* Disclaimer banner — the platform's independence is the single most
            important thing a new user needs to see before anything else. */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6 text-sm text-amber-900 leading-relaxed">
          <p className="font-bold mb-1">Independent fan platform: not affiliated with any club or league</p>
          <p>
            Africa Fantasy is an independent fantasy sports platform for football, cricket, and rugby fans across
            Africa. It is not affiliated with, endorsed by, or officially connected to any sports governing body,
            association, league, or participating club. All third-party names and references are used solely to
            identify real-world teams and players where legally permitted.
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
              These Terms of Service ("<strong>Terms</strong>") govern your access to and use of Africa Fantasy
              (the "<strong>Platform</strong>"), operated by <strong>OMNI Global</strong> ("<strong>we</strong>",
              "<strong>us</strong>", "<strong>our</strong>"). By creating an account or using the Platform, you agree
              to be bound by these Terms and by our Privacy Policy. If you do not agree, do not use the Platform.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">2. Nature of the Platform</h2>
            <p className="mb-3">
              Africa Fantasy is a fan-made fantasy sports platform covering football, cricket, and rugby clubs
              across Africa. It is:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Not affiliated with, endorsed by, sponsored by, or officially connected to any sports governing body, association, league, or real club.</li>
              <li>Built around original branding, scoring rules, and content; it does not use official club crests, kits, or copyrighted media.</li>
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
            <h2 className="text-base font-bold text-zff-black mb-3">4. Game Modes &amp; Rules</h2>
            <p className="mb-3">
              The Platform offers more than one way to play, and not every game mode is always available: the
              Platform may enable or disable individual game modes at its discretion.
            </p>
            <p className="mb-3">
              <strong>Fantasy Teams (football).</strong> Users build a fantasy squad from players across
              participating football clubs, subject to a fixed budget and squad-size rules enforced by the
              Platform. Points are awarded automatically based on real-world match events (goals, assists, clean
              sheets, cards, and minutes played) as recorded by Platform administrators.
            </p>
            <p className="mb-3">
              <strong>Score Predictions (football, cricket &amp; rugby).</strong> Users predict a match's final
              score before kickoff. Points are awarded on accuracy (an exact score, a correct outcome and margin,
              or a correct outcome alone) once the real result is recorded. Predictions lock at kickoff and cannot
              be changed afterward.
            </p>
            <p className="mb-3">
              <strong>Fan Polls.</strong> Users may vote on polls posted by administrators or by members of a
              private group they belong to. Group-created polls are subject to the same content rules as any other
              user content under Section 7.
            </p>
            <p className="mb-3">
              Scoring rules for every game mode are published in-app and may be adjusted between seasons; material
              changes will be announced in advance where practicable.
            </p>
            <p>
              Standings across every game mode are for entertainment purposes. The Platform does not accept
              monetary entry fees, does not operate as a bookmaker, and no feature of the Platform constitutes
              gambling or betting under the laws of any jurisdiction in which it operates.
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

          {/* 7A */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">7A. Release Regarding Other Users</h2>
            <p>
              The Platform includes community features (chat, groups, and polls) where you may interact with other
              users. You are solely responsible for your own interactions with other users. To the fullest extent
              permitted by law, you release OMNI Global from any claims, demands, or damages of any kind arising out
              of or connected with disputes with, or the conduct of, other users of the Platform.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">8. Disclaimer of Warranties</h2>
            <p>
              The Platform is provided "as is" and "as available" without warranties of any kind, whether express,
              implied, or statutory, including but not limited to implied warranties of merchantability, fitness for
              a particular purpose, title, and non-infringement, to the fullest extent permitted by law. We do not
              warrant that the Platform will be uninterrupted, secure, or error-free, that any defect will be
              corrected, or that match statistics, fixtures, or results will always be entered accurately or without
              delay. Fantasy points and standings are informational and for entertainment purposes only, and are not
              a substitute for official match records. We make no warranty regarding, and are not responsible for,
              the conduct or content of any other user or any third party. You use the Platform at your own risk.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">9. Limitation of Liability</h2>
            <p className="mb-3">
              To the maximum extent permitted by law, OMNI Global, its directors, officers, employees, agents,
              contractors, partners, and licensors shall not be liable for any indirect, incidental, special,
              consequential, exemplary, or punitive damages, including loss of profits, data, goodwill, or other
              intangible losses, arising from or relating to: your access to or use of, or inability to access or
              use, the Platform; any conduct or content of any other user or third party on the Platform; any
              unauthorised access to or alteration of your data; or any interruption, suspension, or termination of
              the Platform — even if we have been advised of the possibility of such damages.
            </p>
            <p>
              Our total aggregate liability for any claim arising under or relating to these Terms or the Platform
              shall not exceed the greater of (i) the amount you have paid us in the twelve months preceding the
              claim (which, given free entry, will typically be zero), or (ii) USD $10 (ten United States dollars).
              Nothing in these Terms excludes or limits any liability that cannot lawfully be excluded or limited
              under applicable law, including liability for death or personal injury caused by negligence, or for
              fraud.
            </p>
          </section>

          {/* 9A */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">9A. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless OMNI Global and its directors, officers, employees,
              agents, and licensors from and against any claims, liabilities, damages, losses, costs, and expenses
              (including reasonable legal fees) arising out of or in any way connected with: (a) your access to or
              use of the Platform; (b) your violation of these Terms; (c) your violation of any law or the rights of
              a third party; or (d) any content you submit, post, or transmit through the Platform.
            </p>
          </section>

          {/* 9B */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">9B. General Provisions</h2>
            <p className="mb-2"><strong>Force Majeure.</strong> We are not liable for any failure or delay in performance resulting from causes beyond our reasonable control, including natural disasters, power or internet outages, labour disputes, or governmental action.</p>
            <p className="mb-2"><strong>Severability.</strong> If any provision of these Terms is found unenforceable, that provision will be limited or eliminated to the minimum extent necessary, and the remaining provisions will remain in full force and effect.</p>
            <p className="mb-2"><strong>No Waiver.</strong> Our failure to enforce any right or provision of these Terms will not be considered a waiver of that right or provision.</p>
            <p className="mb-2"><strong>Entire Agreement.</strong> These Terms, together with our Privacy Policy, constitute the entire agreement between you and OMNI Global regarding the Platform and supersede any prior agreements.</p>
            <p><strong>Assignment.</strong> We may assign these Terms, in whole or in part, at any time without notice. You may not assign these Terms without our prior written consent.</p>
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
              <p>Africa Fantasy • Legal</p>
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

export default function TermsClient() {
  return (
    <Suspense fallback={null}>
      <TermsOfServiceContent />
    </Suspense>
  );
}

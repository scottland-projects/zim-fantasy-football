"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Shield } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

function PrivacyPolicyContent() {
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
          <h1 className="font-display text-3xl text-zff-black tracking-wider">PRIVACY POLICY</h1>
          <p className="text-sm text-muted-foreground mt-2">Africa Fantasy • Effective 29 May 2026</p>
        </div>

        {/* Policy card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 sm:p-10 space-y-8 text-sm text-slate-700 leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-zff-green shrink-0" /> 1. About OMNI Global
            </h2>
            <p>
              Africa Fantasy ("<strong>the Platform</strong>") is owned and operated by <strong>OMNI Global</strong>
              ("<strong>we</strong>", "<strong>us</strong>", "<strong>our</strong>"). OMNI Global is the data controller
              responsible for personal information collected through the Platform. By creating an account or using the
              Platform you agree to the practices described in this Privacy Policy.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following categories of personal data:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><strong>Account data:</strong> email address, username, full name, and password (stored as a secure hash).</li>
              <li><strong>Profile data:</strong> supporter branch, favourite player, bio, avatar image, and team name.</li>
              <li><strong>Usage data:</strong> fantasy team selections, points, transfers, league membership, and activity on the Platform.</li>
              <li><strong>Technical data:</strong> IP address, browser type, device identifiers, and access timestamps collected automatically when you use the Platform.</li>
              <li><strong>Communications:</strong> messages or reports you submit to us through support channels.</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> collect payment card information directly. Any future payment processing will be
              handled by a certified third-party provider, and only transaction references will be stored by us.
            </p>
          </section>

          {/* 2A */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">2A. Public Sports Information (Not Personal Data)</h2>
            <p className="mb-3">
              Separately from the personal data described in Section 2, the Platform displays factual sporting
              information about real football, cricket, and rugby competitions in Zimbabwe, including club and team
              names, competition and league names, fixture lists, matchdays, and results. This information:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>is drawn from what we understand to be publicly available knowledge of these competitions, not from any private or confidential source;</li>
              <li>is not personal data: it does not identify any individual user of the Platform and is not collected about you;</li>
              <li>is displayed to every user and visitor as general content (fixtures, predictions targets, results, and related statistics), independent of any individual account; and</li>
              <li>is used only to power gameplay features (Score Predictions, fixtures, and results displays), not to build any profile about you personally.</li>
            </ul>
            <p className="mt-3">
              This is distinct from your personal data: the club and competition information above describes the
              real world of sport, while Section 2 describes information we hold about <em>you</em>: your account,
              the predictions you make, and how you use the Platform. Your predictions and activity linked to your
              account remain personal data and are handled as described elsewhere in this Policy, even though the
              fixtures and results they relate to are not.
            </p>
            <p className="mt-3">
              This Privacy Policy addresses only how this public sporting information relates to your personal data.
              It does not address trademark, copyright, or other intellectual property questions relating to club,
              league, or competition names. Those are addressed in Section 6 of our{" "}
              <Link href="/terms" className="text-zff-green hover:underline">Terms of Service</Link>, including how
              to contact us if you are a rights holder with a concern.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">3. How We Use Your Information</h2>
            <p className="mb-3">OMNI Global uses your personal data to:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Create and manage your account and fantasy team.</li>
              <li>Display leaderboards, rankings, and public profiles to other users of the Platform.</li>
              <li>Send transactional communications (e.g. password resets, matchday results, league notifications).</li>
              <li>Improve, maintain, and secure the Platform.</li>
              <li>Comply with legal obligations and enforce our Terms of Service.</li>
              <li>Send optional marketing communications about OMNI Global products and Africa Fantasy. You may opt out at any time by clicking the unsubscribe link in any marketing email or by emailing <strong>privacy@omniglobal.one</strong> with the subject line &ldquo;Unsubscribe&rdquo;. Opting out will not affect transactional communications required for the operation of your account.</li>
            </ul>
            <p className="mt-3">
              We process your data on the legal bases of <em>contract performance</em> (providing the Platform),
              <em>legitimate interests</em> (security and improvement), and <em>consent</em> (marketing emails).
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">4. Data Sharing</h2>
            <p className="mb-3">We do not sell your personal data. We may share it only with:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><strong>Service providers:</strong> hosting, database, and analytics vendors who process data on our behalf under confidentiality agreements.</li>
              <li><strong>Other users:</strong> your username, team name, and fantasy points are visible on public leaderboards as part of the core functionality of the Platform.</li>
              <li><strong>Legal authorities:</strong> where required by applicable law, court order, or governmental authority.</li>
              <li><strong>Business transfers:</strong> in the event of a merger, acquisition, or asset sale involving OMNI Global, your data may be transferred to the successor entity subject to the same protections.</li>
            </ul>
          </section>

          {/* 4A */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">4A. Third-Party Services</h2>
            <p className="mb-3">
              The Platform may contain links to third-party websites, services, or content. OMNI Global is not responsible
              for the privacy practices, content, or availability of any third-party services. This Privacy Policy applies
              solely to data collected through the Platform. We encourage you to review the privacy policies of any
              third-party services you access.
            </p>
            <p>
              Our infrastructure is supported by third-party hosting and technology providers. While we require all such
              providers to maintain appropriate data security standards, OMNI Global cannot guarantee the security of data
              processed by third-party infrastructure and accepts no liability for any breach, loss, or damage arising
              therefrom, to the extent permitted by applicable law.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">5. Data Retention</h2>
            <p>
              We retain your personal data for as long as your account is active or as necessary to provide the Platform.
              If you close your account, we will delete or anonymise your personal data within 90 days, except where
              retention is required by law or to resolve outstanding disputes. Aggregated, anonymised statistics (e.g.
              season leaderboard snapshots) may be retained indefinitely.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">6. Cookies & Tracking</h2>
            <p>
              The Platform uses essential cookies required for authentication and session management. We may also use
              analytics cookies to understand Platform usage. You can control cookies through your browser settings;
              disabling essential cookies will prevent you from logging in.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">7. Security</h2>
            <p>
              OMNI Global implements industry-standard security measures including encrypted connections (HTTPS/TLS),
              hashed password storage, and access controls. No method of transmission over the internet is 100% secure;
              while we strive to protect your data, we cannot guarantee absolute security. You are responsible for
              keeping your login credentials confidential.
            </p>
          </section>

          {/* 7A */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">7A. Limitation of Liability</h2>
            <p className="mb-3">
              To the maximum extent permitted by applicable law, OMNI Global, its directors, officers, employees, agents,
              partners, and licensors shall not be liable for any indirect, incidental, special, consequential, or punitive
              damages, including but not limited to loss of profits, data, goodwill, or other intangible losses, arising from:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>your use of, or inability to use, the Platform;</li>
              <li>any unauthorised access to or alteration of your data;</li>
              <li>any third-party conduct on the Platform;</li>
              <li>any interruption, suspension, or termination of the Platform.</li>
            </ul>
            <p className="mt-3">
              OMNI Global&apos;s total aggregate liability to you for any claim arising under or in connection with this
              Privacy Policy or the Platform shall not exceed the greater of (i) the amount you paid to OMNI Global in the
              twelve months preceding the claim, or (ii) USD $10 (ten United States dollars).
            </p>
            <p className="mt-3">
              Nothing in this clause limits OMNI Global&apos;s liability for death or personal injury caused by its
              negligence, fraud, or any liability that cannot be excluded by law.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">8. Children&apos;s Privacy</h2>
            <p>
              The Platform is not directed at children under 13 years of age. We do not knowingly collect personal data
              from children under 13. If you believe a child has provided us with personal data, please contact us and
              we will delete it promptly.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">9. Your Rights</h2>
            <p className="mb-3">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><strong>Access</strong> a copy of the personal data we hold about you.</li>
              <li><strong>Rectify</strong> inaccurate or incomplete data via your profile settings.</li>
              <li><strong>Erase</strong> your personal data by deleting your account or submitting a written request.</li>
              <li><strong>Restrict</strong> or <strong>object</strong> to certain processing of your data.</li>
              <li><strong>Data portability:</strong> receive your data in a structured, machine-readable format.</li>
              <li><strong>Withdraw consent</strong> to marketing communications at any time.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email us at{" "}
              <strong>privacy@omniglobal.one</strong>. We will respond within 30 days.
            </p>
          </section>

          {/* 9A */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">9A. Zimbabwe Cyber and Data Protection Act (CDPA) 2021</h2>
            <p className="mb-3">
              This Privacy Policy is intended to comply with Zimbabwe&apos;s Cyber and Data Protection Act [Chapter 12:07]
              (the &ldquo;CDPA&rdquo;) and any regulations made thereunder. Where the CDPA grants you rights as a data
              subject, those rights are in addition to, and not in limitation of, any rights described in Section 9 above.
              In the event of any conflict between this Privacy Policy and the CDPA, the CDPA shall prevail.
            </p>
            <p>
              If you believe your rights under the CDPA have been infringed, you may lodge a complaint with the Postal
              and Telecommunications Regulatory Authority of Zimbabwe (POTRAZ) or such other supervisory authority as may
              be designated under the CDPA.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">10. International Transfers</h2>
            <p>
              OMNI Global operates internationally. Your data may be stored and processed in countries outside your
              own. Where data is transferred outside Zimbabwe, we ensure appropriate safeguards are in place in
              accordance with applicable data protection law.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">11. Changes to This Policy</h2>
            <p>
              OMNI Global reserves the right to update or modify this Privacy Policy at any time without prior notice.
              Changes will be posted on this page with a revised effective date. Continued use of the Platform after
              any changes have been posted constitutes your acceptance of the updated Privacy Policy. We encourage you
              to review this page periodically to stay informed.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-base font-bold text-zff-black mb-3">12. Contact</h2>
            <p>
              For privacy-related enquiries or to exercise your data rights, contact OMNI Global at:
            </p>
            <address className="not-italic mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm space-y-1">
              <p><strong>OMNI Global</strong></p>
              <p>Africa Fantasy • Data Privacy</p>
              <p>Email: <a href="mailto:privacy@omniglobal.one" className="text-zff-green hover:underline">privacy@omniglobal.one</a></p>
            </address>
          </section>

          {/* Governing law */}
          <p className="text-xs text-muted-foreground border-t border-slate-200 pt-6">
            This Privacy Policy is governed by the laws of Zimbabwe. Any disputes shall be subject to the exclusive
            jurisdiction of the courts of Zimbabwe.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          {from === "onboarding" ? (
            <>
              <p className="text-xs text-muted-foreground">
                By clicking &ldquo;Accept &amp; Continue&rdquo; you confirm you have read and agree to this Privacy Policy.
              </p>
              <button
                onClick={() => router.push("/onboarding")}
                className="btn-primary px-8 py-3 text-sm whitespace-nowrap"
              >
                Accept &amp; Continue
              </button>
            </>
          ) : (
            <Link href="/login" className="text-zff-green text-sm hover:underline">
              ← Back to login
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PrivacyClient() {
  return (
    <Suspense>
      <PrivacyPolicyContent />
    </Suspense>
  );
}

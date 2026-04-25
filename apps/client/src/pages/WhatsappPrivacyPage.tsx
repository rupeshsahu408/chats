import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

/**
 * Long-form, bilingual (English / हिन्दी), heavily-sourced
 * documentary-style investigation into WhatsApp's privacy
 * practices, history, controversies, regulatory fines, country-level
 * bans, spyware incidents, leaks, and policy changes.
 *
 * Self-contained: no app shell, no auth, no tRPC. Designed to be
 * shareable as a stand-alone marketing-surface piece on
 * `/blog/whatsapp-privacy-truth`.
 *
 * ─────────── Reading-rule convention ───────────
 * Every factual claim is followed by a numeric citation `[n]` that
 * smooth-scrolls to the matching entry in the SOURCES bibliography
 * at the bottom of the page. The bibliography is rendered once and
 * shared across both languages.
 */

type Source = {
  n: number;
  title: string;
  publisher: string;
  url: string;
  date?: string;
};

const SOURCES: Source[] = [
  { n: 1, title: "Privacy Policy", publisher: "WhatsApp", url: "https://www.whatsapp.com/legal/privacy-policy", date: "current" },
  { n: 2, title: "Privacy Policy — EEA", publisher: "WhatsApp", url: "https://www.whatsapp.com/legal/privacy-policy-eea", date: "current" },
  { n: 3, title: "About information WhatsApp shares with other Meta companies", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/1303762270462331" },
  { n: 4, title: "Does WhatsApp collect or sell your data?", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/2779769622225319" },
  { n: 5, title: "Answering your questions about WhatsApp's January 2021 Privacy Policy update", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/595724415641642", date: "Jan 2021" },
  { n: 6, title: "WhatsApp Channels Supplemental Privacy Policy", publisher: "WhatsApp", url: "https://www.whatsapp.com/legal/channels-privacy-policy" },
  { n: 7, title: "WhatsApp Updates Tab Supplemental Privacy Policy", publisher: "WhatsApp", url: "https://www.whatsapp.com/legal/updatestab-privacy-policy" },
  { n: 8, title: "About end-to-end encrypted backup", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/490592613091019/" },
  { n: 9, title: "End-to-End Encrypted Backups on WhatsApp", publisher: "WhatsApp Blog", url: "https://blog.whatsapp.com/end-to-end-encrypted-backups-on-whatsapp", date: "Oct 14, 2021" },
  { n: 10, title: "How WhatsApp is enabling end-to-end encrypted backups", publisher: "Engineering at Meta", url: "https://engineering.fb.com/2021/09/10/security/whatsapp-e2ee-backups/", date: "Sep 10, 2021" },
  { n: 11, title: "Helping You Find More Channels and Businesses on WhatsApp", publisher: "Meta Newsroom", url: "https://about.fb.com/news/2025/06/helping-you-find-more-channels-businesses-on-whatsapp/", date: "Jun 16, 2025" },
  { n: 12, title: "Helping you Find More Channels and Businesses on WhatsApp", publisher: "WhatsApp Blog", url: "https://blog.whatsapp.com/helping-you-find-more-channels-and-businesses-on-whatsapp", date: "Jun 16, 2025" },
  { n: 13, title: "WhatsApp Launches Ads in Status Updates, Channel Subscriptions", publisher: "Social Media Today", url: "https://www.socialmediatoday.com/news/whatsapp-ads-in-status-promoted-channels-subscriptions/750852/", date: "Jun 2025" },
  { n: 14, title: "About government requests for user data", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/808280033839222" },
  { n: 15, title: "Information for Law Enforcement Authorities", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/444002211197967" },
  { n: 16, title: "Government Requests for User Data — Transparency Center", publisher: "Meta", url: "https://transparency.meta.com/reports/government-data-requests/further-asked-questions/" },
  { n: 17, title: "FBI Document Says the Feds Can Get Your WhatsApp Data — in Real Time", publisher: "Rolling Stone", url: "https://www.rollingstone.com/politics/politics-features/whatsapp-imessage-facebook-apple-fbi-privacy-1261816/", date: "Dec 2021" },
  { n: 18, title: "Pegasus spyware maker NSO must pay $167M in WhatsApp lawsuit", publisher: "Axios", url: "https://www.axios.com/2025/05/06/nso-group-whatsapp-jury-damages", date: "May 6, 2025" },
  { n: 19, title: "Winning the Fight Against Spyware Merchant NSO", publisher: "Meta Newsroom", url: "https://about.fb.com/news/2025/05/winning-the-fight-against-spyware-merchant-nso/", date: "May 2025" },
  { n: 20, title: "Ruling against NSO Group in WhatsApp case a 'momentous win in fight against spyware abuse'", publisher: "Amnesty International", url: "https://www.amnesty.org/en/latest/news/2025/05/ruling-against-nso-group-in-whatsapp-case-a-momentous-win/", date: "May 2025" },
  { n: 21, title: "NSO Group Fined $168M for Targeting 1,400 WhatsApp Users With Pegasus Spyware", publisher: "The Hacker News", url: "https://thehackernews.com/2025/05/nso-group-fined-168m-for-targeting-1400.html", date: "May 2025" },
  { n: 22, title: "Eight things we learned from WhatsApp vs. NSO Group spyware lawsuit", publisher: "TechCrunch", url: "https://techcrunch.com/2025/05/30/eight-things-we-learned-from-whatsapp-vs-nso-group-spyware-lawsuit/", date: "May 30, 2025" },
  { n: 23, title: "Graphite Caught: First Forensic Confirmation of Paragon's iOS Mercenary Spyware Finds Journalists Targeted", publisher: "The Citizen Lab", url: "https://citizenlab.ca/research/first-forensic-confirmation-of-paragons-ios-mercenary-spyware-finds-journalists-targeted/", date: "2025" },
  { n: 24, title: "WhatsApp says a spyware company targeted journalists and civilians in a global campaign", publisher: "NBC News", url: "https://www.nbcnews.com/tech/security/whatsapp-says-spyware-company-paragon-solutions-targeted-journalists-rcna190227", date: "Jan 2025" },
  { n: 25, title: "Europe: Paragon attacks highlight Europe's growing spyware crisis", publisher: "Amnesty International", url: "https://www.amnesty.org/en/latest/news/2025/03/europe-paragon-attacks-highlight-europes-growing-spyware-crisis/", date: "Mar 2025" },
  { n: 26, title: "Italy: New case of journalist targeted with Graphite spyware", publisher: "Amnesty International", url: "https://www.amnesty.org/en/latest/news/2025/06/italy-new-case-of-journalist-targeted-with-graphite-spyware-confirms-widespread-use-of-unlawful-surveillance/", date: "Jun 2025" },
  { n: 27, title: "Data Protection Commission announces decision in WhatsApp inquiry", publisher: "Irish DPC", url: "https://www.dataprotection.ie/en/news-media/press-releases/data-protection-commission-announces-decision-whatsapp-inquiry", date: "Sep 2, 2021" },
  { n: 28, title: "Irish Commissioner Fines WhatsApp €225 Million For GDPR Violations", publisher: "Hunton Andrews Kurth", url: "https://www.hunton.com/privacy-and-information-security-law/irish-commissioner-fines-whatsapp-e225-million-for-gdpr-violations", date: "Sep 2021" },
  { n: 29, title: "NCLAT quashes CCI's WhatsApp-Meta data ban, upholds ₹213 crore penalty", publisher: "Business Standard", url: "https://www.business-standard.com/industry/news/nclat-sets-aside-cci-data-sharing-ban-upholds-meta-penalty-2025-125110401578_1.html", date: "Nov 2025" },
  { n: 30, title: "CCI imposes Rs 213 crore penalty on Meta over sharing WhatsApp data", publisher: "OpIndia", url: "https://www.opindia.com/2024/11/indian-regulator-cci-imposes-rs-213-crore-penalty-on-meta-over-sharing-whatsapp-data-with-other-entities/", date: "Nov 2024" },
  { n: 31, title: "WhatsApp's 2021 Policy Update And The Legal Battles — A Timeline", publisher: "MediaNama", url: "https://www.medianama.com/2025/12/223-whatsapps-2021-privacy-policy-update-legal-battles-cci-timeline/", date: "Dec 2025" },
  { n: 32, title: "2021 WhatsApp privacy policy updates", publisher: "Consumer Rights Wiki", url: "https://consumerrights.wiki/w/2021_WhatsApp_privacy_policy_updates" },
  { n: 33, title: "Reception and criticism of WhatsApp security and privacy features", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Reception_and_criticism_of_WhatsApp_security_and_privacy_features" },
  { n: 34, title: "Senior Facebook executive arrested in Brazil after police are denied access to data", publisher: "The Washington Post", url: "https://www.washingtonpost.com/world/national-security/senior-facebook-executive-arrested-in-brazil-after-police-denied-access-to-data/2016/03/01/f66d114c-dfe5-11e5-9c36-e1902f6b6571_story.html", date: "Mar 1, 2016" },
  { n: 35, title: "Facebook LatAm VP arrested in Brazil over failure to comply with WhatsApp court order", publisher: "TechCrunch", url: "https://techcrunch.com/2016/03/01/facebook-latam-vp-arrested-in-brazil-over-failure-to-comply-with-whatsapp-court-order/", date: "Mar 2016" },
  { n: 36, title: "Link Previews: How a Simple Feature Can Have Privacy and Security Risks", publisher: "Mysk Blog", url: "https://mysk.blog/2020/10/25/link-previews/", date: "Oct 25, 2020" },
  { n: 37, title: "Experts Warn of Privacy Risks Caused by Link Previews in Messaging Apps", publisher: "The Hacker News", url: "https://thehackernews.com/2020/10/mobile-messaging-apps.html", date: "Oct 2020" },
  { n: 38, title: "Meta Removes 6.8 Million WhatsApp Scam Accounts in First Half of 2025", publisher: "Sumsub", url: "https://sumsub.com/media/news/meta-removes-whatsapp-scam-accounts/", date: "2025" },
  { n: 39, title: "WhatsApp Has Taken Out 6.8 Million Scam Accounts in 2025", publisher: "CPO Magazine", url: "https://www.cpomagazine.com/cyber-security/whatsapp-has-taken-out-6-8-million-scam-accounts-in-2025/", date: "2025" },
  { n: 40, title: "Pegasus (spyware)", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Pegasus_(spyware)" },
  { n: 41, title: "Pegasus and surveillance spyware", publisher: "European Parliament", url: "https://www.europarl.europa.eu/RegData/etudes/IDAN/2022/732268/IPOL_IDA(2022)732268_EN.pdf", date: "2022" },
  { n: 42, title: "India: Human Rights Defenders Targeted by a Coordinated Spyware Operation", publisher: "Amnesty International", url: "https://www.amnesty.org/en/latest/research/2020/06/india-human-rights-defenders-targeted-by-a-coordinated-spyware-operation/", date: "Jun 2020" },
  { n: 43, title: "Caught in the Network: The Impact of WhatsApp's 2021 Privacy Policy Update", publisher: "ACM CHI", url: "https://dl.acm.org/doi/fullHtml/10.1145/3491102.3502032", date: "2022" },
  { n: 44, title: "WhatsApp & Data Privacy in 2025 — Risks, GDPR & Alternatives", publisher: "heyData", url: "https://heydata.eu/en/magazine/whatsapp-privacy-2025/", date: "2025" },
  { n: 45, title: "WhatsApp Privacy Policy Explained — End-to-End Encryption Isn't the Whole Story", publisher: "Ayan Rayne", url: "https://ayanrayne.com/2025/09/deep-dive-audits/privacy-policy/whatsapp-privacy-metadata-explained/", date: "Sep 2025" },
  { n: 46, title: "Data privacy & security — WhatsApp Cloud API", publisher: "Meta for Developers", url: "https://developers.facebook.com/documentation/business-messaging/whatsapp/data-privacy-and-security/" },
  { n: 47, title: "WhatsApp App Review 2025: Privacy, Pros and Cons, Personal Data", publisher: "Mozilla *Privacy Not Included", url: "https://www.mozillafoundation.org/en/nothing-personal/whatsapp-privacy-review/", date: "2025" },
  { n: 48, title: "US probes claims Meta can access encrypted WhatsApp messages", publisher: "Computing.co.uk", url: "https://www.computing.co.uk/news/2025/legislation-regulation/us-probes-claims-meta-can-access-encrypted-whatsapp-messages-report", date: "2025" },
  { n: 49, title: "Hamburg DPA — Jurisdictions", publisher: "DataGuidance", url: "https://www.dataguidance.com/jurisdictions/germany-hamburg" },
  { n: 50, title: "Meta Hit with Record $1.3B GDPR Fine", publisher: "InformationWeek", url: "https://www.informationweek.com/data-management/meta-hit-with-record-1-3b-gdpr-fine", date: "May 2023" },
  { n: 51, title: "Facebook to Acquire WhatsApp", publisher: "About Meta (Newsroom)", url: "https://about.fb.com/news/2014/02/facebook-to-acquire-whatsapp/", date: "Feb 19, 2014" },
  { n: 52, title: "Press Release: Facebook to Acquire WhatsApp (8-K Exhibit 99.1)", publisher: "U.S. SEC", url: "https://www.sec.gov/Archives/edgar/data/1326801/000132680114000010/exhibit991_pressrelease219.htm", date: "Feb 2014" },
  { n: 53, title: "WhatsApp", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/WhatsApp" },
  { n: 54, title: "Brian Acton", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Brian_Acton" },
  { n: 55, title: "WhatsApp Co-Founder, Who Made Billions from Facebook, Says It's Time to #DeleteFacebook", publisher: "Fortune", url: "https://fortune.com/2018/03/21/delete-facebook-cambridge-analytica-whatsapp-brian-acton/", date: "Mar 21, 2018" },
  { n: 56, title: "WhatsApp founder plans to leave after broad clashes with parent Facebook", publisher: "The Washington Post", url: "https://www.washingtonpost.com/business/economy/whatsapp-founder-plans-to-leave-after-broad-clashes-with-parent-facebook/2018/04/30/49448dd2-4ca9-11e8-84a0-458a1aa9ac0a_story.html", date: "Apr 30, 2018" },
  { n: 57, title: "WhatsApp CEO Jan Koum quits Facebook due to privacy intrusions", publisher: "TechCrunch", url: "https://techcrunch.com/2018/04/30/jan-koum-quits-facebook/", date: "Apr 30, 2018" },
  { n: 58, title: "WhatsApp Cofounder Brian Acton Explains Why He Felt He Had To Sell To Facebook", publisher: "BuzzFeed News", url: "https://www.buzzfeednews.com/article/ryanmac/whatsapp-brian-acton-delete-facebook-stanford-lecture", date: "Sep 2018" },
  { n: 59, title: "WhatsApp data leaked: 500 million user records for sale online", publisher: "Cybernews", url: "https://cybernews.com/news/whatsapp-data-leak/", date: "Nov 2022" },
  { n: 60, title: "WhatsApp 2022 Data Breach: What Happened, Impact, and Lessons", publisher: "Huntress", url: "https://www.huntress.com/threat-library/data-breach/whatsapp-data-breach", date: "2022" },
  { n: 61, title: "Facebook–Cambridge Analytica data scandal", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Facebook%E2%80%93Cambridge_Analytica_data_scandal" },
  { n: 62, title: "Why Is WhatsApp Banned in China? — The Security Reasons", publisher: "Host Merchant Services", url: "https://hostmerchantservices.com/2024/08/whatsapp-banned-in-china/", date: "Aug 2024" },
  { n: 63, title: "Iran 'Bans' WhatsApp Over 'Zionist' Zuckerberg", publisher: "Jewish Telegraphic Agency", url: "https://www.jta.org/2014/05/04/israel/iran-bans-whatsapp-over-american-zionist-zuckerberg", date: "May 2014" },
  { n: 64, title: "Iran to lift ban on WhatsApp, Google Play, state media report", publisher: "Al Jazeera", url: "https://www.aljazeera.com/news/2024/12/24/iran-to-lift-ban-on-whatsapp-google-play-state-media-report", date: "Dec 2024" },
  { n: 65, title: "WhatsApp will not apply controversial data-sharing rules in Turkey", publisher: "Daily Sabah", url: "https://www.dailysabah.com/business/tech/whatsapp-will-not-apply-controversial-data-sharing-rules-in-turkey", date: "2021" },
  { n: 66, title: "Turkey fines WhatsApp €197,000 over controversial privacy update", publisher: "Euronews", url: "https://www.euronews.com/2021/09/03/turkey-fines-whatsapp-197-000-over-controversial-privacy-update", date: "Sep 2021" },
  { n: 67, title: "Indian WhatsApp lynchings", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Indian_WhatsApp_lynchings" },
  { n: 68, title: "Viral WhatsApp Messages Are Triggering Mob Killings In India", publisher: "NPR", url: "https://www.npr.org/2018/07/18/629731693/fake-news-turns-deadly-in-india", date: "Jul 18, 2018" },
  { n: 69, title: "WhatsApp to Cap Forwards to 5 Chats in India", publisher: "The Quint", url: "https://www.thequint.com/news/india/whatsapp-mob-lynching-cap-on-fake-forwards-fake-news", date: "Jul 2018" },
  { n: 70, title: "WhatsApp limits message forwarding to combat coronavirus misinformation", publisher: "MIT Technology Review", url: "https://www.technologyreview.com/2020/04/07/998517/whatsapp-limits-message-forwarding-combat-coronavirus-misinformation/", date: "Apr 7, 2020" },
  { n: 71, title: "Pegasus: Phones of 40 journalists from Indian Express, Hindu, HT & Wire tapped", publisher: "ThePrint", url: "https://theprint.in/india/pegasus-phones-of-40-journalists-from-indian-express-hindu-ht-wire-tapped-says-report/698393/", date: "Jul 2021" },
  { n: 72, title: "India's Supreme Court orders independent probe following Pegasus Project investigation", publisher: "The Washington Post", url: "https://www.washingtonpost.com/world/2021/10/27/india-pegasus-supreme-court/", date: "Oct 27, 2021" },
  { n: 73, title: "Jeff Bezos phone hacking incident", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Jeff_Bezos_phone_hacking_incident" },
  { n: 74, title: "UN calls for investigation after Saudi prince implicated in Bezos phone hack", publisher: "CNN Business", url: "https://www.cnn.com/2020/01/22/tech/jeff-bezos-mbs-phone-hack", date: "Jan 22, 2020" },
  { n: 75, title: "A UAE agency put Pegasus spyware on phone of Khashoggi's wife months before his murder", publisher: "The Washington Post", url: "https://www.washingtonpost.com/nation/interactive/2021/hanan-elatr-phone-pegasus/", date: "Dec 2021" },
  { n: 76, title: "Pegasus: The new global weapon for silencing journalists", publisher: "Forbidden Stories", url: "https://forbiddenstories.org/pegasus-the-new-global-weapon-for-silencing-journalists/", date: "Jul 2021" },
  { n: 77, title: "Mexico Used Private Israeli Spyware Pegasus to Surveil President's Family & a Murdered Journalist", publisher: "Democracy Now!", url: "https://www.democracynow.org/2021/7/20/nso_group_surveillance_mexico", date: "Jul 2021" },
  { n: 78, title: "UAE: Activist Ahmed Mansoor sentenced to 10 years in prison for social media posts", publisher: "Amnesty International", url: "https://www.amnesty.org/en/latest/news/2018/05/uae-activist-ahmed-mansoor-sentenced-to-10-years-in-prison-for-social-media-posts/", date: "May 2018" },
  { n: 79, title: "UAE: Ahmed Mansoor's 15-Year Sentence Upheld", publisher: "Human Rights Watch", url: "https://www.hrw.org/news/2025/03/07/uae-ahmed-mansoors-15-year-sentence-upheld", date: "Mar 2025" },
  { n: 80, title: "CatalanGate: Extensive Mercenary Spyware Operation against Catalans", publisher: "The Citizen Lab", url: "https://citizenlab.ca/research/catalangate-extensive-mercenary-spyware-operation-against-catalans-using-pegasus-candiru/", date: "Apr 18, 2022" },
  { n: 81, title: "About the Pegasus Project", publisher: "Forbidden Stories", url: "https://forbiddenstories.org/about-the-pegasus-project/", date: "Jul 2021" },
  { n: 82, title: "Pegasus Project (investigation)", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Pegasus_Project_(investigation)" },
  { n: 83, title: "HIDE AND SEEK: Tracking NSO Group's Pegasus Spyware to Operations in 45 Countries", publisher: "The Citizen Lab", url: "https://citizenlab.ca/2018/09/hide-and-seek-tracking-nso-groups-pegasus-spyware-to-operations-in-45-countries/", date: "Sep 18, 2018" },
  { n: 84, title: "Spyware: MEPs sound alarm on threat to democracy and demand reforms (PEGA)", publisher: "European Parliament", url: "https://www.europarl.europa.eu/news/en/press-room/20230505IPR84901/spyware-meps-sound-alarm-on-threat-to-democracy-and-demand-reforms", date: "May 5, 2023" },
  { n: 85, title: "Bug lets anyone bypass WhatsApp's 'View Once' privacy feature", publisher: "TechCrunch", url: "https://techcrunch.com/2024/09/09/bug-lets-anyone-bypass-whatsapps-view-once-privacy-feature/", date: "Sep 9, 2024" },
  { n: 86, title: "WhatsApp's View Once privacy issue (research)", publisher: "Zengo X Research", url: "https://zengo.com/whatsapps-view-once-privacy-issue/", date: "2024" },
  { n: 87, title: "Researcher Discovers 4th WhatsApp View Once Bypass; Meta Won't Patch", publisher: "SecurityWeek", url: "https://www.securityweek.com/researcher-discovers-4th-whatsapp-view-once-bypass-meta-wont-patch/", date: "2024" },
  { n: 88, title: "How WhatsApp enables multi-device capability", publisher: "Engineering at Meta", url: "https://engineering.fb.com/2021/07/14/security/whatsapp-multi-device/", date: "Jul 14, 2021" },
  { n: 89, title: "Open Whisper Systems", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Open_Whisper_Systems" },
  { n: 90, title: "Signal Protocol", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Signal_Protocol" },
  { n: 91, title: "Building Private Processing for AI tools on WhatsApp", publisher: "Engineering at Meta", url: "https://engineering.fb.com/2025/04/29/security/whatsapp-private-processing-ai-tools/", date: "Apr 29, 2025" },
  { n: 92, title: "WhatsApp Advanced Chat Privacy: Block Meta AI", publisher: "Qualimero", url: "https://qualimero.com/en/blog/whatsapp-chat-privacy", date: "2025" },
  { n: 93, title: "From Jurisdictional Battles to Crypto Wars: Brazilian Courts v. WhatsApp", publisher: "Berkeley Technology Law Journal", url: "https://btlj.org/2017/02/from-jurisdictional-battles-to-crypto-wars-brazilian-courts-v-whatsapp/", date: "2017" },
  { n: 94, title: "Brazilian judge blocks WhatsApp nationwide", publisher: "Phys.org / AFP", url: "https://phys.org/news/2016-07-brazil-blocks-whatsapp-messenger-application.html", date: "Jul 2016" },
  { n: 95, title: "Why Did Brazil Block WhatsApp?", publisher: "Foreign Policy", url: "https://foreignpolicy.com/2015/12/17/why-did-brazil-block-whatsapp/", date: "Dec 17, 2015" },
  { n: 96, title: "Meta 'concerned' Iran could ban WhatsApp after snooping claims", publisher: "Al Jazeera", url: "https://www.aljazeera.com/economy/2025/6/18/meta-concerned-iran-could-ban-whatsapp-after-snooping-claims", date: "Jun 2025" },
  { n: 97, title: "Turkey: Erdogan's media office quits WhatsApp over privacy change", publisher: "Al Jazeera", url: "https://www.aljazeera.com/news/2021/1/10/turkey-erdogans-media-office-quits-whatsapp-over-privacy-change", date: "Jan 10, 2021" },
];

function S({ ids }: { ids: number[] }) {
  return (
    <sup className="ml-0.5 text-[#2E6F40] font-semibold whitespace-nowrap">
      [
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 ? "," : ""}
          <a
            href={`#src-${id}`}
            className="hover:underline focus:underline"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById(`src-${id}`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-2", "ring-[#2E6F40]/40");
                window.setTimeout(
                  () => el.classList.remove("ring-2", "ring-[#2E6F40]/40"),
                  1600,
                );
              }
            }}
          >
            {id}
          </a>
        </span>
      ))}
      ]
    </sup>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 mt-16 mb-5 text-[28px] sm:text-[32px] leading-tight font-semibold tracking-tight text-[#0F2A18]"
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-9 mb-3 text-[20px] sm:text-[22px] font-semibold text-[#143521]">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[17px] leading-[1.78] text-[#1f2a24] mb-5">
      {children}
    </p>
  );
}

function Quote({
  children,
  cite,
}: {
  children: React.ReactNode;
  cite: string;
}) {
  return (
    <figure className="my-6 border-l-4 border-[#2E6F40] bg-[#F1F8EE] rounded-r-lg px-5 py-4">
      <blockquote className="text-[16.5px] leading-[1.7] text-[#19261c] italic">
        “{children}”
      </blockquote>
      <figcaption className="mt-2 text-[13px] text-[#4a5a4f] not-italic">
        — {cite}
      </figcaption>
    </figure>
  );
}

function Callout({
  tone = "warn",
  title,
  children,
}: {
  tone?: "warn" | "info" | "danger";
  title: string;
  children: React.ReactNode;
}) {
  const palette = {
    warn: { bg: "#FFF6E5", bd: "#E2A53A", ic: "⚠️" },
    info: { bg: "#EAF4FF", bd: "#3A7BC8", ic: "ℹ️" },
    danger: { bg: "#FDECEC", bd: "#C2453A", ic: "🛑" },
  }[tone];
  return (
    <aside
      className="my-6 rounded-xl px-5 py-4 border"
      style={{ backgroundColor: palette.bg, borderColor: palette.bd + "55" }}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-xl leading-none mt-0.5">
          {palette.ic}
        </span>
        <div>
          <div className="font-semibold text-[#1f2a24] mb-1">{title}</div>
          <div className="text-[15.5px] leading-[1.7] text-[#1f2a24]">
            {children}
          </div>
        </div>
      </div>
    </aside>
  );
}

function useReadingProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      const v = total > 0 ? (h.scrollTop / total) * 100 : 0;
      setPct(Math.min(100, Math.max(0, v)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return pct;
}

/* ───────────────────────── Table of contents ───────────────────────── */

const TOC_EN: { id: string; label: string }[] = [
  { id: "tldr", label: "TL;DR — what this article proves" },
  { id: "owners", label: "1. Who actually owns WhatsApp" },
  { id: "founders", label: "2. The founders walked out — over privacy" },
  { id: "policy", label: "3. What the Privacy Policy actually says" },
  { id: "metadata", label: "4. Metadata — what E2EE doesn't hide" },
  { id: "y2021", label: "5. The 2021 forced policy update" },
  { id: "backups", label: "6. The cloud-backup loophole" },
  { id: "business", label: "7. WhatsApp Business — when E2EE quietly ends" },
  { id: "ads", label: "8. Ads inside WhatsApp (June 2025)" },
  { id: "ai", label: "9. Meta AI inside your chat list" },
  { id: "law", label: "10. Governments and law enforcement" },
  { id: "pegasus", label: "11. Pegasus — the $167M NSO verdict" },
  { id: "victims", label: "12. The Pegasus victims, country by country" },
  { id: "paragon", label: "13. Paragon Graphite (2025)" },
  { id: "leaks", label: "14. Leaks, bugs, and broken features" },
  { id: "leak2022", label: "15. The 2022 leak of 487 million numbers" },
  { id: "fines", label: "16. Regulatory fines and bans" },
  { id: "bans", label: "17. Country-level bans and forced shutdowns" },
  { id: "lynch", label: "18. WhatsApp, fake news and lynchings in India" },
  { id: "delete", label: "19. What 'delete account' really deletes" },
  { id: "scams", label: "20. Scams at industrial scale" },
  { id: "verdict", label: "21. The verdict for high-privacy users" },
  { id: "sources", label: "Sources & references" },
];

const TOC_HI: { id: string; label: string }[] = [
  { id: "tldr", label: "संक्षेप में — यह लेख क्या साबित करता है" },
  { id: "owners", label: "1. WhatsApp का असली मालिक कौन है" },
  { id: "founders", label: "2. खुद इसके फ़ाउंडर ही प्राइवेसी पर लड़कर निकले" },
  { id: "policy", label: "3. प्राइवेसी पॉलिसी असल में क्या कहती है" },
  { id: "metadata", label: "4. मेटाडेटा — एन्क्रिप्शन जो छुपा नहीं सकता" },
  { id: "y2021", label: "5. 2021 की ज़बरदस्ती वाली पॉलिसी" },
  { id: "backups", label: "6. क्लाउड बैकअप की कमज़ोरी" },
  { id: "business", label: "7. WhatsApp Business — जहाँ E2EE चुपचाप ख़त्म होता है" },
  { id: "ads", label: "8. WhatsApp के अंदर विज्ञापन (जून 2025)" },
  { id: "ai", label: "9. आपकी चैट लिस्ट में Meta AI" },
  { id: "law", label: "10. सरकारें और क़ानून-व्यवस्था" },
  { id: "pegasus", label: "11. Pegasus — $167M का NSO फ़ैसला" },
  { id: "victims", label: "12. Pegasus के शिकार, देश-दर-देश" },
  { id: "paragon", label: "13. Paragon Graphite (2025)" },
  { id: "leaks", label: "14. लीक, बग और टूटे हुए फ़ीचर" },
  { id: "leak2022", label: "15. 2022 का 48.7 करोड़ नंबरों का लीक" },
  { id: "fines", label: "16. नियामक जुर्माने और रोक" },
  { id: "bans", label: "17. देश-स्तर पर WhatsApp पर रोक" },
  { id: "lynch", label: "18. WhatsApp, फ़र्ज़ी ख़बरें और भारत में लिंचिंग" },
  { id: "delete", label: "19. 'अकाउंट डिलीट' असल में क्या डिलीट करता है" },
  { id: "scams", label: "20. औद्योगिक स्तर पर स्कैम" },
  { id: "verdict", label: "21. हाई-प्राइवेसी यूज़र के लिए नतीजा" },
  { id: "sources", label: "स्रोत और सन्दर्भ" },
];

/* ───────────────────────────── ENGLISH ARTICLE ───────────────────────────── */

function ArticleEnglish() {
  return (
    <>
      <H2 id="tldr">TL;DR — what this article proves</H2>
      <ul className="space-y-3 text-[17px] leading-[1.75] text-[#1f2a24] list-none">
        <li><strong>1.</strong> WhatsApp is owned by Meta — the same company that owns Facebook, Instagram, Messenger and Threads, and the same company whose 2018 Cambridge Analytica scandal is one of the largest data-misuse events in history.<S ids={[51, 52, 53, 61]} /></li>
        <li><strong>2.</strong> WhatsApp's own founders publicly broke with Meta over data and monetisation. Brian Acton tweeted “It is time. #deletefacebook” in 2018 and walked away from roughly $850 million in unvested stock to do it. Jan Koum left a few weeks later, citing clashes over data sharing and weakening of encryption.<S ids={[54, 55, 56, 57, 58]} /></li>
        <li><strong>3.</strong> WhatsApp's Privacy Policy says it collects your phone number, contacts (including non-users'), profile photo, status, device model, OS, IP address, mobile network, app usage, location-derived signals, payment info — and shares much of it with the rest of Meta.<S ids={[1, 2, 3]} /></li>
        <li><strong>4.</strong> End-to-end encryption protects message <em>content</em>. It does not hide who you talk to, when, how often, from where, or with which device.<S ids={[1, 2, 17, 45]} /></li>
        <li><strong>5.</strong> Cloud backups (Google Drive, iCloud) are <em>not</em> end-to-end encrypted by default; the user has to opt in.<S ids={[8, 9, 10]} /></li>
        <li><strong>6.</strong> Meta announced ads, promoted channels and paid subscriptions inside WhatsApp's Updates tab on 16 June 2025 at Cannes Lions.<S ids={[11, 12, 13]} /></li>
        <li><strong>7.</strong> Ireland's DPC fined WhatsApp €225 million in 2021. India's CCI fined Meta ₹213 crore in 2024. Turkey opened formal investigations and fined WhatsApp in 2021.<S ids={[27, 28, 29, 30, 65, 66]} /></li>
        <li><strong>8.</strong> WhatsApp has been the delivery surface for at least two confirmed nation-state spyware products: NSO Group's Pegasus (US jury fined NSO $167M in 2025) and Paragon's Graphite (2025, journalists targeted in Italy).<S ids={[18, 19, 20, 23, 24, 25, 26]} /></li>
        <li><strong>9.</strong> 487 million WhatsApp phone numbers across 84 countries were put up for sale on a hacking forum in November 2022.<S ids={[59, 60]} /></li>
        <li><strong>10.</strong> Brazil has court-ordered WhatsApp shutdowns at least four times. China blocks it entirely. Iran has banned it. Turkey, Russia, the UAE and Saudi Arabia heavily restrict it.<S ids={[33, 62, 63, 64, 93, 94, 95]} /></li>
        <li><strong>11.</strong> WhatsApp-borne misinformation triggered a wave of mob lynchings in India in 2017–2018; WhatsApp had to cap message-forwarding to 5 chats and later to 1.<S ids={[67, 68, 69, 70]} /></li>
        <li><strong>12.</strong> Even the “View Once” privacy feature has been bypassed by independent researchers four separate times.<S ids={[85, 86, 87]} /></li>
      </ul>

      <Callout tone="info" title="Reading rule used in this piece">
        Every sentence that contains a fact is followed by a number in
        square brackets that links to a primary source. If you don't
        trust this article, you don't have to — click the number and
        read it yourself. That is the whole point.
      </Callout>

      {/* 1. OWNERS */}
      <H2 id="owners">1. Who actually owns WhatsApp</H2>
      <P>
        WhatsApp is not an independent company. On 19 February 2014
        Facebook (now Meta Platforms, Inc.) announced its acquisition of
        WhatsApp Inc. for approximately <strong>US $19 billion</strong> —
        $4 billion in cash, $12 billion in Facebook stock, and an
        additional ~$3 billion in restricted stock units for founders
        and employees vesting over four years.<S ids={[51, 52, 53]} /> At
        the time, WhatsApp had roughly 55 employees and 450 million
        monthly active users — which works out, on a back-of-the-envelope
        basis, to roughly $345 million per employee, the most expensive
        software acquisition ever made on a per-headcount basis.<S ids={[51, 52, 53]} />
      </P>
      <P>
        That ownership matters because the Meta family of products is
        the same family inside which the 2018 Cambridge Analytica
        scandal happened — a scandal that exposed the personal data of
        roughly <strong>87 million</strong> Facebook users to a
        political-targeting consultancy without their consent, and led
        to the largest-ever FTC fine for a privacy violation
        (US $5 billion against Facebook in 2019).<S ids={[61]} /> Whatever
        you think of WhatsApp's engineering team, the chain of ultimate
        responsibility leads back to a parent company with a
        well-documented history of data-misuse incidents.
      </P>

      {/* 2. FOUNDERS */}
      <H2 id="founders">
        2. The founders walked out — over privacy
      </H2>
      <P>
        WhatsApp was founded in 2009 by <strong>Jan Koum</strong>, a
        Ukrainian-born immigrant who grew up on US food stamps, and
        <strong> Brian Acton</strong>. Koum personally taped a printed
        note to his desk that he could see while working: “No Ads! No
        Games! No Gimmicks!”.<S ids={[53, 54, 58]} />
      </P>
      <P>
        That promise lasted four years after the Facebook acquisition.
        On 20 March 2018 — at the height of the Cambridge Analytica
        scandal — Brian Acton broke his post-acquisition silence and
        tweeted <em>“It is time. #deletefacebook”</em>. By that point
        Acton had already left the company, walking away from roughly
        <strong> US $850 million</strong> in unvested Facebook stock
        because he refused to wait out the vesting cliff while staying
        inside a company whose direction he no longer agreed with.<S ids={[55, 58]} />
      </P>
      <Quote cite="Forbes / Fortune coverage of Brian Acton, March 2018 [55]">
        It is time. #deletefacebook.
      </Quote>
      <P>
        Six weeks later, on 30 April 2018, Jan Koum announced he would
        also leave Meta and step down from Facebook's board. The
        Washington Post reported that Koum's departure followed broad
        clashes with Facebook leadership — over the use of WhatsApp
        users' personal data, over Facebook's attempts to weaken
        WhatsApp's end-to-end encryption to enable business messaging
        features, and over plans to monetise WhatsApp through ads.<S ids={[56, 57]} />
      </P>
      <Callout tone="danger" title="Both of WhatsApp's founders left over privacy">
        Two billionaires, with combined unvested stock north of a
        billion dollars, walked out of the company they built rather
        than implement what Meta wanted to do with WhatsApp's data.
        Almost everything that has happened to WhatsApp since — the
        2021 policy update, the Cloud API for businesses, the 2025 ads
        announcement — is exactly what the founders refused to build.<S ids={[55, 56, 57, 58]} />
      </Callout>

      {/* 3. POLICY */}
      <H2 id="policy">3. What the Privacy Policy actually says</H2>
      <P>
        The single most important document in this entire investigation
        is the one almost nobody reads: WhatsApp's own Privacy
        Policy.<S ids={[1, 2]} /> Read in full, here is what WhatsApp
        itself confirms it collects:
      </P>
      <H3>3.1 Data WhatsApp collects directly from you</H3>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>Mobile phone number (mandatory).<S ids={[1, 2]} /></li>
        <li>Profile name, profile photo, “About” text.<S ids={[1, 2]} /></li>
        <li>Your address book / contacts list, including the numbers of people who have <em>never</em> used WhatsApp.<S ids={[1, 4, 47]} /></li>
        <li>Status updates (with read/view receipts), Channels and Communities content.<S ids={[6, 7]} /></li>
        <li>Payments and transaction information, where applicable.<S ids={[1]} /></li>
        <li>Anything you submit through customer support or feedback.<S ids={[1, 2]} /></li>
      </ul>
      <H3>3.2 Data WhatsApp collects automatically</H3>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>Hardware model, operating system, battery level, signal strength, app version, browser, mobile network and connection information (including phone number, mobile country code, mobile network code).<S ids={[1, 2]} /></li>
        <li>IP address, language, time zone, and information that lets WhatsApp infer your approximate location even without precise GPS.<S ids={[1, 2, 45]} /></li>
        <li>Device identifiers, advertising identifiers, unique application identifiers, browser identifiers, cookies.<S ids={[1, 2]} /></li>
        <li>Usage and log information: features used, frequency, time, duration, and details of how you interact with others — timing, frequency, contacts.<S ids={[1, 2, 45]} /></li>
        <li>Performance and diagnostic logs — crash data, app logs, performance reports.<S ids={[1, 2]} /></li>
      </ul>
      <H3>3.3 Data WhatsApp shares with “other Meta companies”</H3>
      <P>
        WhatsApp's own help center confirms it shares information with
        the rest of Meta to help “operate, provide, improve, understand,
        customize, support, and market” services.<S ids={[3]} />
      </P>
      <Quote cite="WhatsApp Help Center: 'About information WhatsApp shares with other Meta companies' [3]">
        We share information with other Meta companies to, for example,
        help operate, provide, improve, understand, customize, support
        and market our Services and their offerings.
      </Quote>
      <P>
        The categories shared include account registration information
        (your phone number), transaction data, service-related
        information, information about how you interact with others
        (including businesses), mobile device information, your IP
        address, and other information identified in the Privacy
        Policy.<S ids={[1, 3]} />
      </P>
      <Callout tone="warn" title="Why this matters even with E2EE">
        End-to-end encryption only protects message <em>content</em>.
        Phone number, contacts, IP, device, usage frequency, who you
        message, when, from where — none of it is encrypted from Meta's
        view, because Meta is the party generating and storing it.<S ids={[1, 17, 45]} />
      </Callout>

      {/* 4. METADATA */}
      <H2 id="metadata">4. Metadata — what E2EE doesn't hide</H2>
      <P>
        WhatsApp's marketing leans on the lock icon: “Messages and
        calls are end-to-end encrypted. No one outside this chat, not
        even WhatsApp, can read or listen to them.” That sentence is
        true. It is also extraordinarily narrow.<S ids={[4]} />
      </P>
      <P>
        End-to-end encryption protects the <em>payload</em> — the words
        you wrote, the photo you sent, the audio of a call. It does not
        protect the <em>envelope</em>: the fact that you, at this phone
        number, sent a message to that other phone number, at this
        time, from this IP address, on this device, while connected to
        this Wi-Fi network or cell tower.<S ids={[1, 2, 17, 45]} />
      </P>
      <P>
        A leaked FBI training document published by Rolling Stone in
        2021 confirms how rich WhatsApp metadata is compared to
        truly minimal-metadata services like Signal: with appropriate
        legal process, WhatsApp can return basic subscriber records,
        the address-book contacts of the target, the address-book
        contacts who have the target in <em>their</em> address book —
        and, uniquely among major encrypted apps, pen-register style
        data showing the source and destination of every message
        <em> in near-real time</em>.<S ids={[17]} />
      </P>
      <Quote cite="FBI document on lawful access to encrypted apps, reported by Rolling Stone, Dec 2021 [17]">
        WhatsApp produces certain metadata pursuant to a pen register;
        message sender and receiver source and destination IP
        addresses, including for messages sent over WhatsApp's web and
        desktop apps, are returned in near real time.
      </Quote>
      <P>
        For comparison, the same FBI document lists Signal as
        returning, at most, the date the account was created and the
        date it last connected — and nothing else.<S ids={[17]} />
      </P>

      {/* 5. 2021 */}
      <H2 id="y2021">5. The 2021 forced policy update</H2>
      <P>
        On 4 January 2021 WhatsApp pushed an in-app notice telling
        users they had until 8 February to accept a new privacy policy
        or lose access to the app.<S ids={[5, 31, 32]} /> Unlike the 2016
        policy, which gave users a one-time option to opt out of
        sharing certain data with Facebook, the 2021 update removed
        that choice for everyone who had not opted out at the
        time.<S ids={[31, 32, 43]} />
      </P>
      <P>
        The reaction was immediate. Tens of millions of users
        downloaded Signal and Telegram in the weeks that followed —
        peer-reviewed research at ACM CHI later quantified the
        global shift.<S ids={[43]} /> WhatsApp responded with status
        messages, newspaper ads and a delay of the deadline to 15 May
        2021.<S ids={[5, 31]} />
      </P>
      <P>
        The substance of the 2021 changes was about (a) data flows
        when you message a Business account, including data
        potentially processed by Facebook's hosting, and (b) deeper
        integration of WhatsApp into the Meta family.<S ids={[5, 32, 33]} /> That update is the same one that triggered India's
        Competition Commission case (see §16) and Ireland's DPC
        investigation that led to the €225 million fine in 2021 (see
        §16).<S ids={[27, 28, 29, 30, 31]} />
      </P>

      {/* 6. BACKUPS */}
      <H2 id="backups">6. The cloud-backup loophole</H2>
      <P>
        Suppose, for a moment, that WhatsApp's E2EE is flawless. Even
        then there is a well-known door around it: backups.
      </P>
      <P>
        WhatsApp messages are backed up to your phone's cloud — Google
        Drive on Android, iCloud on iPhone — so you can restore them
        on a new device. Until 2021 those backups were{" "}
        <em>not</em> end-to-end encrypted at all: a copy of every
        message you ever sent sat in your cloud account, accessible
        to law enforcement with the appropriate order to Apple or
        Google.<S ids={[8, 9, 10]} />
      </P>
      <P>
        In October 2021 WhatsApp introduced an{" "}
        <em>optional</em> end-to-end encrypted backup feature. The user
        has to turn it on, and the user has to remember a 64-digit
        encryption key (or set a password — and lose every message
        forever if they forget it).<S ids={[8, 9, 10]} /> WhatsApp has
        never claimed E2EE backups are the default.<S ids={[8]} />
      </P>
      <Callout tone="danger" title="The practical effect">
        Most WhatsApp users with cloud backup are handing a complete,
        indexable, plain-text archive of their chat history to either
        Apple or Google — and, by extension, to any government with
        the legal leverage to compel them.<S ids={[9, 10]} />
      </Callout>

      {/* 7. BUSINESS */}
      <H2 id="business">7. WhatsApp Business — when E2EE quietly ends</H2>
      <P>
        Increasingly, the “other side” of a WhatsApp conversation is
        not a person — it is an airline, a bank, a delivery service, a
        hospital, or a government office that has integrated with
        WhatsApp through Meta's Business Platform / Cloud API.<S ids={[46]} />
      </P>
      <P>
        When you message a business that uses Meta's hosted Cloud API,
        your message is encrypted in transit between your phone and
        the Cloud API endpoint — but at that endpoint{" "}
        <strong>Meta itself decrypts the message</strong> in order to
        deliver it to the business, and the business may then store,
        log, archive or share that message according to its own
        policies.<S ids={[46]} />
      </P>
      <Quote cite="Meta for Developers — WhatsApp Cloud API: Data privacy & security [46]">
        With the Cloud API hosted by Meta, the encryption layer
        between WhatsApp users and the business has its endpoint at
        the Cloud API. As the host of the Cloud API endpoint, Meta is
        a third party in the conversation between a WhatsApp user and
        a business.
      </Quote>
      <P>
        Most users will never read that sentence. They see a lock
        icon at the top of the chat with a business and assume the
        usual end-to-end protections apply. They do not — and Meta's
        own developer documentation says so plainly.<S ids={[46]} />
      </P>

      {/* 8. ADS */}
      <H2 id="ads">8. Ads inside WhatsApp (June 2025)</H2>
      <P>
        For more than a decade WhatsApp leadership — including its
        original founders — promised there would never be ads inside
        WhatsApp. That promise ended publicly on 16 June 2025 at
        Cannes Lions, where Meta announced ads in the WhatsApp Updates
        tab.<S ids={[11, 12, 13]} />
      </P>
      <Quote cite="Meta Newsroom: 'Helping You Find More Channels and Businesses on WhatsApp', Jun 16 2025 [11]">
        Today, we're announcing new updates to make it easier for you
        to discover and follow channels and businesses on WhatsApp,
        including channel subscriptions, promoted channels and ads in
        Status — all in the Updates tab, which is separate from your
        personal chats and calls.
      </Quote>
      <P>Three monetisation surfaces were announced:</P>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li><strong>Ads in Status:</strong> full-screen ads slipped between the Status updates of contacts you follow.<S ids={[11, 12, 13]} /></li>
        <li><strong>Promoted Channels:</strong> sponsored placement of channels in the discovery directory.<S ids={[11, 13]} /></li>
        <li><strong>Channel subscriptions:</strong> paid channels with exclusive content.<S ids={[11, 13]} /></li>
      </ul>
      <P>
        Meta says these ads will not use your <em>messages</em>{" "}
        (because Meta cannot read encrypted messages) but will use
        signals such as your country, language, the channels you
        follow, and how you interact with ads — i.e. the metadata
        stack described in §3 and §4.<S ids={[11, 12]} />
      </P>

      {/* 9. AI */}
      <H2 id="ai">9. Meta AI inside your chat list</H2>
      <P>
        In 2024 Meta rolled Meta AI directly into WhatsApp's interface
        as a permanent contact in the chat list — non-removable in
        most regions.<S ids={[91, 92]} /> Meta has stated that prompts
        sent <em>to</em> Meta AI are processed by Meta and used to
        improve the model, and that messages forwarded by users into
        Meta AI conversations leave the end-to-end encrypted
        envelope.<S ids={[91]} /> In April 2025, Meta engineering
        published a design for what it calls{" "}
        <em>Private Processing</em> intended to allow some AI
        operations on encrypted data, but the feature is opt-in,
        Meta-controlled, and has not been independently audited at
        scale.<S ids={[91]} />
      </P>
      <P>
        In April 2025 the EU launched an investigation into whether
        Meta's claim that its WhatsApp encryption keeps Meta out of
        chats can be reconciled with the company's stated ability to
        process AI prompts inside chats — a question that has not yet
        been definitively resolved.<S ids={[48]} />
      </P>

      {/* 10. LAW */}
      <H2 id="law">10. Governments and law enforcement</H2>
      <P>
        WhatsApp has a published process for governments and law
        enforcement to request user data, run by Meta's Law
        Enforcement Response Team.<S ids={[14, 15, 16]} /> With the
        appropriate legal order, WhatsApp can produce:
      </P>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>Basic subscriber records — phone number, account creation date, last seen, device information.<S ids={[14, 15, 17]} /></li>
        <li>Address-book contacts of the target, and address-book contacts who have the target in their address book — i.e. a partial map of the target's social graph.<S ids={[17]} /></li>
        <li>With a pen-register order: source and destination IP addresses for messages, in near-real time, including for WhatsApp Web and Desktop sessions.<S ids={[17]} /></li>
        <li>For accounts that use unencrypted iCloud or Google Drive backups, message content can be obtained by serving the cloud provider directly.<S ids={[8, 9, 10, 17]} /></li>
      </ul>
      <P>
        What WhatsApp <em>cannot</em> hand over (assuming the
        encryption stack is honoured) is the actual content of an
        end-to-end encrypted message in transit.<S ids={[14, 15]} /> That
        protection is real — but as the FBI's own internal document
        and Meta's transparency reports show, “content” is a small
        slice of what investigators care about.<S ids={[16, 17]} />
      </P>

      {/* 11. PEGASUS */}
      <H2 id="pegasus">11. Pegasus — the $167M NSO verdict</H2>
      <P>
        In May 2019 WhatsApp discovered an attack against its
        voice-call feature: an attacker could place a call to a
        target and, even if the target did not answer, deploy NSO
        Group's Pegasus spyware onto the device by exploiting{" "}
        <strong>CVE-2019-3568</strong>.<S ids={[19, 21, 33, 40]} /> WhatsApp
        identified more than 1,400 targets across roughly 20 countries
        — journalists, human-rights defenders, lawyers, academics,
        diplomats and opposition politicians.<S ids={[19, 20, 21, 22, 41, 42]} />
      </P>
      <P>
        Six years of litigation later, on 6 May 2025, a US federal
        jury in California ordered NSO Group to pay WhatsApp/Meta{" "}
        <strong>$167.25 million in punitive damages</strong> plus
        roughly $444,000 in compensatory damages.<S ids={[18, 19, 20, 21, 22]} /> Court documents revealed NSO had developed something
        it internally called the “WhatsApp Installation Server,”
        explicitly designed to weaponise WhatsApp's infrastructure
        against its own users.<S ids={[19, 22]} />
      </P>
      <Quote cite="Amnesty International on the verdict, May 2025 [20]">
        Today's ruling against NSO Group is a momentous win in the
        fight against spyware abuse and a critical step in protecting
        human rights defenders, journalists and civil society from
        unlawful surveillance.
      </Quote>

      {/* 12. VICTIMS */}
      <H2 id="victims">12. The Pegasus victims, country by country</H2>
      <P>
        Two parallel investigations — Citizen Lab's
        <em> Hide and Seek</em> in 2018 and the{" "}
        <strong>Pegasus Project</strong> in 2021 (a consortium of 17
        media organisations across 10 countries, coordinated by
        Forbidden Stories with Amnesty International's Security Lab)
        — established that Pegasus had been used in at least 45
        countries, with a leaked list of more than 50,000 phone
        numbers selected for surveillance by NSO clients.<S ids={[81, 82, 83]} />
      </P>
      <H3>12.1 Saudi Arabia — Khashoggi & Bezos</H3>
      <P>
        Jamal Khashoggi was a <em>Washington Post</em> columnist and
        critic of Saudi Crown Prince Mohammed bin Salman who was
        murdered inside the Saudi consulate in Istanbul on 2 October
        2018.<S ids={[75, 76]} /> Forensic analysis later established
        that Pegasus had been planted on the phone of Khashoggi's
        wife <strong>Hanan Elatr</strong> by an UAE agency months
        before his murder, and that the phone of his fiancée Hatice
        Cengiz was infected days after his killing.<S ids={[75, 76]} />
      </P>
      <P>
        Separately, in May 2018 Amazon founder{" "}
        <strong>Jeff Bezos</strong>'s phone was, according to a 2019
        forensic analysis by FTI Consulting commissioned by Bezos,
        likely infiltrated via an MP4 video file sent from the
        WhatsApp account personally used by Mohammed bin Salman.<S ids={[73, 74]} /> The UN later called for an investigation
        into the alleged hack.<S ids={[74]} />
      </P>
      <H3>12.2 India — at least 121 WhatsApp targets, hundreds more</H3>
      <P>
        On 30 October 2019 WhatsApp confirmed that approximately{" "}
        <strong>121 users in India</strong> had been targeted via the
        same WhatsApp Pegasus exploit (CVE-2019-3568). Two years
        later, the Pegasus Project published a list of more than 300
        verified Indian phone numbers selected as potential Pegasus
        targets — including journalists from The Indian Express, The
        Hindu, Hindustan Times and The Wire, sitting cabinet
        ministers, opposition leaders, election commission staff and
        Supreme Court personnel.<S ids={[71, 72]} /> The Indian
        Supreme Court later ordered an independent technical
        committee to investigate; that committee returned in 2022
        unable to confirm or deny use, in part because the Indian
        government refused to cooperate with the inquiry.<S ids={[72]} />
      </P>
      <H3>12.3 Mexico — surveillance and a murdered journalist</H3>
      <P>
        Mexico was the first confirmed government client of NSO
        Group. In 2017 Citizen Lab documented Pegasus targeting of
        Mexican journalists, lawyers and anti-corruption activists.
        The Pegasus Project later revealed that the phone of
        freelance crime reporter <strong>Cecilio Pineda Birto</strong> 
        was selected for targeting weeks before he was shot dead in
        Guerrero state on 2 March 2017.<S ids={[76, 77, 80, 82]} />
      </P>
      <H3>12.4 UAE — Ahmed Mansoor</H3>
      <P>
        Citizen Lab's first public exposure of Pegasus came in 2016
        when researchers documented the targeting of UAE human-rights
        defender <strong>Ahmed Mansoor</strong>.<S ids={[40, 78, 79]} /> 
        Mansoor was arrested in March 2017, sentenced in 2018 to 10
        years in prison for social-media posts, and in March 2025 the
        UAE upheld a 15-year sentence against him.<S ids={[78, 79]} />
      </P>
      <H3>12.5 Spain — CatalanGate</H3>
      <P>
        In April 2022 Citizen Lab documented the use of Pegasus and
        the related Candiru spyware against{" "}
        <strong>at least 65 individuals</strong> connected to the
        Catalan independence movement, including elected officials,
        lawyers, civil society leaders and family members. Citizen
        Lab described it as “the largest forensically documented
        cluster of such attacks and infections on record.”<S ids={[80]} />
      </P>
      <H3>12.6 The wider geography</H3>
      <P>
        The Citizen Lab's 2018 <em>Hide and Seek</em> report mapped
        Pegasus operations across at least 45 countries, including
        Algeria, Bahrain, Bangladesh, Brazil, Canada, Côte d'Ivoire,
        Egypt, France, Greece, Hungary, India, Iraq, Israel, Jordan,
        Kazakhstan, Kenya, Kuwait, Kyrgyzstan, Latvia, Lebanon,
        Libya, Mexico, Morocco, the Netherlands, Oman, Pakistan,
        Palestine, Poland, Qatar, Rwanda, Saudi Arabia, Singapore,
        South Africa, Switzerland, Tajikistan, Thailand, Togo,
        Tunisia, Turkey, the UAE, Uganda, the United Kingdom, the
        United States, Uzbekistan, Yemen and Zambia.<S ids={[83]} /> WhatsApp
        was a primary delivery vector for many of these.
      </P>

      {/* 13. PARAGON */}
      <H2 id="paragon">13. Paragon Graphite (2025)</H2>
      <P>
        In late January 2025 WhatsApp publicly disclosed that
        approximately <strong>90 users</strong> — including
        journalists and members of civil society — had been targeted
        with a different mercenary spyware product called Graphite,
        made by the Israeli firm Paragon Solutions, via a zero-click
        vector that again exploited WhatsApp.<S ids={[24, 25]} />
      </P>
      <P>
        Citizen Lab subsequently published the first forensic
        confirmation of Paragon Graphite on iOS, identifying multiple
        victims in <strong>Italy</strong>, where journalists and an
        executive of a migrant-rescue NGO were confirmed targets.<S ids={[23, 25, 26]} />
      </P>
      <Callout tone="danger" title="The pattern, not the bug">
        Pegasus and Graphite are different products from different
        companies, but the pattern is identical: high-value targets +
        WhatsApp + a zero-click exploit + plausible deniability for
        the buyer. WhatsApp's installed base of 3 billion+ users makes
        it the single most attractive surface on Earth.<S ids={[20, 22, 25, 26]} />
      </Callout>

      {/* 14. LEAKS */}
      <H2 id="leaks">14. Leaks, bugs, and broken features</H2>
      <H3>14.1 Link-preview IP and content leakage (2020)</H3>
      <P>
        In October 2020, security researchers Talal Haj Bakry and
        Tommy Mysk published research showing that link previews in
        several major messaging apps could leak user IP addresses,
        download large files in the background, and surface portions
        of links sent inside end-to-end encrypted chats to a
        server-side preview generator.<S ids={[36, 37]} />
      </P>
      <H3>14.2 “View Once” bypassed — four times</H3>
      <P>
        Tal Be'ery and the Zengo X Research Team have publicly
        disclosed at least <strong>four separate ways</strong> to
        bypass WhatsApp's “View Once” feature, which is supposed to
        delete a media item after a single viewing. The bypasses have
        included missing client-side enforcement on web/desktop, the
        ability to download a copy via WhatsApp Web while the media
        was being “viewed once,” and incomplete server-side metadata
        flagging. SecurityWeek reported in 2024 that, after the fourth
        bypass, Meta indicated it would not patch the underlying
        issue.<S ids={[85, 86, 87]} />
      </P>
      <H3>14.3 Click-to-chat phone-number indexing (2020)</H3>
      <P>
        Researcher Athul Jayaram showed that WhatsApp's “Click to
        Chat” feature was creating public URLs containing users' phone
        numbers in plain text — URLs Google was indexing, allowing
        anyone to discover phone numbers of WhatsApp users via a
        normal web search.<S ids={[33]} />
      </P>

      {/* 15. 2022 LEAK */}
      <H2 id="leak2022">15. The 2022 leak of 487 million numbers</H2>
      <P>
        On 16 November 2022, a dataset of approximately{" "}
        <strong>487 million WhatsApp users' active mobile phone
        numbers</strong>, spanning 84 countries, was put up for sale
        on the Breached.vc hacking forum.<S ids={[59, 60]} /> Cybernews
        verified the data with the seller and reported that the
        sample matched live WhatsApp users.<S ids={[59]} /> The largest
        country slices included Egypt (~45M), Italy (~35M), USA
        (~32M), Saudi Arabia (~29M), France (~20M), Turkey (~20M)
        and the UK (~11M).<S ids={[59, 60]} />
      </P>
      <P>
        The seller's claim was that the data had been
        scraped/collected at scale; WhatsApp publicly disputed the
        characterisation but did not deny that the underlying phone
        numbers belonged to live WhatsApp accounts.<S ids={[59, 60]} />
      </P>

      {/* 16. FINES */}
      <H2 id="fines">16. Regulatory fines and bans</H2>

      <H3>16.1 Ireland — €225 million GDPR fine (2021)</H3>
      <P>
        On 2 September 2021 the Irish Data Protection Commission
        fined WhatsApp Ireland Ltd <strong>€225 million</strong> for
        breaches of the EU General Data Protection
        Regulation.<S ids={[27, 28]} /> The investigation began in
        December 2018 and concluded that WhatsApp had failed to meet
        GDPR's transparency obligations — i.e. it had not adequately
        informed users (and non-users whose phone numbers ended up in
        friends' address books) about what was happening to their
        data, including data flows between WhatsApp and other Meta
        companies.<S ids={[27, 28]} />
      </P>

      <H3>16.2 India — ₹213 crore fine + 5-year data ban (2024)</H3>
      <P>
        On 18 November 2024 the Competition Commission of India fined
        Meta <strong>₹213.14 crore</strong> (approx. US $25.4
        million) and ordered WhatsApp <em>not</em> to share user data
        with other Meta companies for advertising purposes for 5
        years, ruling that the 2021 “take it or leave it” privacy
        policy was an abuse of dominant position.<S ids={[29, 30, 31]} />
      </P>
      <P>
        On 4 November 2025 NCLAT issued its final order quashing the
        5-year ban but <em>upholding</em> the ₹213 crore penalty
        against Meta.<S ids={[29, 31]} /> Meta and WhatsApp have
        appealed to the Indian Supreme Court; in November 2025 the
        Supreme Court publicly rebuked Meta over the privacy breach
        while declining to disturb the upheld penalty.<S ids={[29, 31]} />
      </P>

      <H3>16.3 Hamburg, Turkey, and the wider European pressure</H3>
      <P>
        The 2021 policy update also triggered emergency action from
        Germany's Hamburg DPA, which issued a three-month order
        banning Facebook (Meta) from processing additional WhatsApp
        user data under the new policy.<S ids={[32, 49]} /> Turkey's
        competition and data-protection authorities opened formal
        investigations the same month; Erdogan's media office
        publicly switched away from WhatsApp to BiP, a Turkish
        alternative.<S ids={[65, 66, 97]} /> In May 2023, Ireland's DPC
        fined Meta a record <strong>€1.2 billion</strong> over data
        transfers, the largest GDPR fine ever issued.<S ids={[50]} />
      </P>

      {/* 17. BANS */}
      <H2 id="bans">17. Country-level bans and forced shutdowns</H2>

      <H3>17.1 China — fully blocked since 2017</H3>
      <P>
        WhatsApp is fully blocked by China's Great Firewall. The
        block began in mid-2017 with throttling of voice and video
        calls and escalated by September 2017 to a complete block on
        text messages — ostensibly because WhatsApp's end-to-end
        encryption prevented Chinese authorities from inspecting
        message content.<S ids={[62]} /> Chinese users have to use a
        VPN to access WhatsApp, which is itself a legally grey
        activity inside China.
      </P>

      <H3>17.2 Iran — banned since 2014, reopened in late 2024</H3>
      <P>
        Iran first banned WhatsApp in May 2014. The official
        rationale, given by Abdolsamad Khorramabadi, head of Iran's
        Committee for Determining Criminal Web Content, was that
        WhatsApp was owned by Facebook, which had been founded by
        Mark Zuckerberg, an “American Zionist.”<S ids={[63]} /> Iran
        announced a partial lifting of the ban on 24 December 2024,
        though Meta has publicly stated it remains concerned about
        ongoing Iranian government surveillance attempts against
        WhatsApp.<S ids={[64, 96]} />
      </P>

      <H3>17.3 Brazil — four court-ordered blocks (2015–2016)</H3>
      <P>
        Between February 2015 and July 2016, Brazilian courts
        ordered the temporary nationwide shutdown of WhatsApp at
        least four times — and in March 2016 the country's federal
        police arrested Diego Dzodan, then Facebook's Vice President
        for Latin America, on his way into the office, after
        WhatsApp told a court it could not produce the content of
        encrypted messages it did not have. He was held overnight
        before a higher court ordered his release.<S ids={[34, 35, 93, 94, 95]} />
      </P>

      <H3>17.4 Turkey, Russia, Saudi Arabia, UAE</H3>
      <P>
        Turkey's data-protection regulator opened formal probes into
        WhatsApp's 2021 policy update, fined the company in 2021,
        and the country's largest telecom operator launched a
        homegrown rival (BiP) which gained over 10 million users in
        a week.<S ids={[65, 66, 97]} /> Russia has alternated between
        de facto restrictions and explicit calls to ban WhatsApp;
        Roskomnadzor has been openly hostile.<S ids={[33]} /> Saudi
        Arabia and the UAE have historically blocked WhatsApp voice
        and video calls (forcing users onto government-licensed
        carriers), even as their state agencies have been
        documented using WhatsApp as an attack surface for spyware
        against dissidents (Mansoor, Khashoggi's circle, Bezos).<S ids={[73, 74, 75, 78, 79]} />
      </P>

      {/* 18. LYNCH */}
      <H2 id="lynch">18. WhatsApp, fake news and lynchings in India</H2>
      <P>
        Between 2017 and 2018, India experienced a wave of mob
        lynchings triggered by viral child-abduction and
        organ-harvesting rumours forwarded on WhatsApp groups. At
        least <strong>36 people</strong> were killed across roughly
        70 incidents, concentrated in Maharashtra, Uttar Pradesh,
        Tripura and other states.<S ids={[67, 68]} />
      </P>
      <P>
        Under sustained pressure from the Indian government,
        WhatsApp introduced a series of forwarding limits — first
        capping forwards at <strong>five chats</strong> in India in
        July 2018,<S ids={[69]} /> and then in April 2020 globally
        restricting any message that had already been forwarded five
        or more times to <strong>one chat at a time</strong>, in
        response to COVID-19 misinformation.<S ids={[70]} /> The
        platform also added a “forwarded” label and, later, a
        “forwarded many times” label to flag virality.
      </P>
      <Callout tone="warn" title="A platform problem, not just a user problem">
        End-to-end encryption combined with frictionless mass
        forwarding inside a 200+ million-user country produced an
        information environment in which violence-triggering rumours
        could spread faster than any newsroom or regulator could
        respond. The deaths are not WhatsApp's intent — but the
        causal architecture is undeniable.<S ids={[67, 68, 69, 70]} />
      </Callout>

      {/* 19. DELETE */}
      <H2 id="delete">19. What “delete account” really deletes</H2>
      <P>
        WhatsApp's EEA Privacy Policy states that when you delete
        your account, the company will delete the information it
        maintains about you, except as noted in the policy.<S ids={[2]} /> 
        The technical deletion process can take up to 90 days from
        the date of your deletion request, and copies of certain
        information (log records, abuse-prevention data, certain
        backups) may remain in WhatsApp's systems after that for
        legal, fraud-prevention and security purposes.<S ids={[2, 44]} />
      </P>
      <P>Deleting <em>your</em> account does not delete:</P>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>Messages and media that <em>other people</em> received from you and saved on their devices.<S ids={[2, 44]} /></li>
        <li>Your phone number from <em>other people's</em> address books, which WhatsApp may have stored.<S ids={[1, 4]} /></li>
        <li>Information shared into Channels, Communities or Status, governed by additional supplemental policies.<S ids={[6, 7]} /></li>
        <li>Backups stored in <em>your own</em> Google Drive or iCloud account, governed by the cloud provider's policies.<S ids={[8, 9, 10]} /></li>
      </ul>

      {/* 20. SCAMS */}
      <H2 id="scams">20. Scams at industrial scale</H2>
      <P>
        Privacy is not only about who reads your messages — it is
        also about who can reach you, impersonate you, or take over
        your account. Meta itself disclosed that it removed
        approximately <strong>6.8 million</strong> WhatsApp accounts
        linked to criminal scam operations in the first half of 2025
        alone, most traced to organised scam compounds in Southeast
        Asia.<S ids={[38, 39]} />
      </P>
      <P>
        Local authorities report rapidly rising losses tied to
        WhatsApp-borne fraud — investment scams, romance scams,
        fake-customer-service scams, account-takeover via SIM-swap
        and OTP-phishing — across markets ranging from India to
        Brazil to Belgium.<S ids={[39]} />
      </P>

      {/* 21. VERDICT */}
      <H2 id="verdict">21. The verdict for high-privacy users</H2>
      <P>
        Be careful with the framing here. WhatsApp is not malware. End-to-end
        encryption on standard person-to-person chats is real, well-implemented
        (it uses the Signal Protocol, originally co-authored by Moxie Marlinspike
        of Open Whisper Systems<S ids={[89, 90]} />), and a meaningful improvement
        over unencrypted SMS. For a user whose threat model is{" "}
        <em>“I do not want my neighbour reading my messages over public Wi-Fi”</em>,
        WhatsApp is genuinely good enough.
      </P>
      <P>But this article is for the other user — the user whose threat model includes one or more of:</P>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>“I do not want a single corporation building a behavioural profile of who I talk to, when, and from where, and using that profile to sell me ads.”<S ids={[1, 11, 12, 17, 45]} /></li>
        <li>“I do not want my phone number, my contact graph and my device fingerprint sitting inside the same company that owns Facebook, Instagram and Threads.”<S ids={[1, 3, 27, 28, 29]} /></li>
        <li>“I do not want unencrypted plain-text copies of my messages sitting in a cloud account that can be served with a subpoena.”<S ids={[8, 9, 10, 17]} /></li>
        <li>“I do not want to be on the platform that nation-state spyware vendors design entire products around abusing.”<S ids={[18, 19, 20, 22, 23, 24, 25, 26]} /></li>
        <li>“I do not want messages I send to a business to be decrypted by Meta in the middle.”<S ids={[46]} /></li>
        <li>“When I delete my account, I want it gone — not gone within 90 days minus logs minus backups minus copies on my friends' phones minus channel posts.”<S ids={[2, 44]} /></li>
      </ul>
      <P>
        For that user, WhatsApp is structurally the wrong tool. Not because the
        engineers are bad — they are very good — but because the surrounding
        business model, parent company, legal exposure and feature roadmap (ads,
        channels, businesses, AI assistants in chats) all pull in the opposite
        direction from what a high-privacy user wants. Regulators have said
        this. Courts have said this. Mozilla's <em>Privacy Not Included</em>{" "}
        reviewers have said this. Even WhatsApp's own founders said this on
        their way out the door.<S ids={[27, 28, 29, 30, 47, 55, 56, 57]} />
      </P>

      <Callout tone="info" title="What VeilChat does differently">
        VeilChat is built on the opposite assumption: minimum identity, minimum
        metadata, no ads, no parent company monetising your social graph,
        encrypted-by-default backups, and no business inbox in the middle
        decrypting messages on our servers. You don't have to take our word for
        it — read our{" "}
        <Link to="/promises" className="text-[#2E6F40] underline">Promises</Link>{" "}
        page, our{" "}
        <Link to="/what-we-store" className="text-[#2E6F40] underline">What We Store</Link>{" "}
        page, and our{" "}
        <Link to="/encryption" className="text-[#2E6F40] underline">Encryption</Link>{" "}
        page, and judge for yourself.
      </Callout>
    </>
  );
}

/* ───────────────────────────── HINDI ARTICLE ───────────────────────────── */

function ArticleHindi() {
  return (
    <>
      <H2 id="tldr">संक्षेप में — यह लेख क्या साबित करता है</H2>
      <ul className="space-y-3 text-[17px] leading-[1.75] text-[#1f2a24] list-none">
        <li><strong>1.</strong> WhatsApp आज Meta का है — वही कंपनी जो Facebook, Instagram, Messenger और Threads भी चलाती है, और वही कंपनी जिसका 2018 का Cambridge Analytica काण्ड इतिहास के सबसे बड़े डेटा-दुरुपयोग में गिना जाता है।<S ids={[51, 52, 53, 61]} /></li>
        <li><strong>2.</strong> WhatsApp के असली फ़ाउंडर खुद डेटा और पैसा कमाने के तरीक़े पर Meta से लड़कर निकले। Brian Acton ने 2018 में सार्वजनिक रूप से ट्वीट किया <em>“It is time. #deletefacebook”</em> और लगभग $850 मिलियन का unvested स्टॉक छोड़कर चले गए। कुछ ही हफ़्तों बाद Jan Koum भी डेटा-शेयरिंग और एन्क्रिप्शन कमज़ोर करने पर मतभेदों का हवाला देकर निकल गए।<S ids={[54, 55, 56, 57, 58]} /></li>
        <li><strong>3.</strong> WhatsApp की अपनी प्राइवेसी पॉलिसी मानती है कि वह आपका फ़ोन नंबर, आपकी पूरी कॉन्टैक्ट लिस्ट (वो लोग भी जो WhatsApp इस्तेमाल नहीं करते), प्रोफ़ाइल फ़ोटो, स्टेटस, डिवाइस मॉडल, OS, IP एड्रेस, मोबाइल नेटवर्क, ऐप यूसेज, अनुमानित लोकेशन और पेमेंट जानकारी इकट्ठा करता है — और इसका बड़ा हिस्सा बाक़ी Meta कंपनियों के साथ शेयर करता है।<S ids={[1, 2, 3]} /></li>
        <li><strong>4.</strong> End-to-end एन्क्रिप्शन सिर्फ़ मैसेज की <em>सामग्री</em> छुपाता है। यह नहीं छुपाता कि आप किससे बात कर रहे हैं, कब, कितनी बार, कहाँ से और किस डिवाइस से।<S ids={[1, 2, 17, 45]} /></li>
        <li><strong>5.</strong> Google Drive / iCloud पर बैकअप डिफ़ॉल्ट रूप से end-to-end एन्क्रिप्टेड <em>नहीं</em> है — यूज़र को खुद चालू करना पड़ता है।<S ids={[8, 9, 10]} /></li>
        <li><strong>6.</strong> 16 जून 2025 को Meta ने Cannes Lions में औपचारिक रूप से घोषणा की कि WhatsApp के Updates टैब में विज्ञापन, प्रमोटेड चैनल और पेड सब्सक्रिप्शन आ रहे हैं।<S ids={[11, 12, 13]} /></li>
        <li><strong>7.</strong> आयरलैंड के डेटा प्रोटेक्शन कमिशन ने 2021 में WhatsApp पर €22.5 करोड़ (€225 मिलियन) का GDPR जुर्माना लगाया। भारत के CCI ने 2024 में Meta पर ₹213 करोड़ का जुर्माना लगाया। तुर्की ने 2021 में जाँच खोली और जुर्माना भी लगाया।<S ids={[27, 28, 29, 30, 65, 66]} /></li>
        <li><strong>8.</strong> WhatsApp कम-से-कम दो पुष्ट nation-state स्पाइवेयर का डिलीवरी सरफ़ेस रहा है — NSO का Pegasus (US कोर्ट ने 2025 में $167M जुर्माना सुनाया) और Paragon का Graphite (2025, इटली में पत्रकार निशाना)।<S ids={[18, 19, 20, 23, 24, 25, 26]} /></li>
        <li><strong>9.</strong> नवंबर 2022 में 84 देशों के लगभग 48.7 करोड़ WhatsApp फ़ोन नंबर एक हैकिंग फ़ोरम पर बिक्री के लिए डाले गए।<S ids={[59, 60]} /></li>
        <li><strong>10.</strong> ब्राज़ील की अदालतें कम-से-कम चार बार WhatsApp को बंद करवा चुकी हैं। चीन में पूरी तरह बंद है। ईरान में बैन रहा। तुर्की, रूस, UAE और सऊदी अरब ने भी कड़ी पाबंदियाँ लगाई हैं।<S ids={[33, 62, 63, 64, 93, 94, 95]} /></li>
        <li><strong>11.</strong> WhatsApp पर वायरल हुई फ़र्ज़ी ख़बरों ने 2017–2018 में भारत में मॉब लिंचिंग की लहर चलाई; इसके बाद WhatsApp को फ़ॉरवर्ड पहले 5 चैट तक, फिर 1 चैट तक सीमित करना पड़ा।<S ids={[67, 68, 69, 70]} /></li>
        <li><strong>12.</strong> यहाँ तक कि “View Once” जैसा प्राइवेसी फ़ीचर भी रिसर्चरों ने चार अलग-अलग तरीक़ों से तोड़कर दिखाया है।<S ids={[85, 86, 87]} /></li>
      </ul>

      <Callout tone="info" title="पढ़ने का नियम">
        इस लेख में हर तथ्य के बाद एक नंबर दिया गया है, जिसे क्लिक करने पर आप
        सीधे उसी स्रोत तक पहुँच जाएँगे। आपको हम पर भरोसा करने की ज़रूरत नहीं —
        खुद सोर्स पढ़कर मिलाइए।
      </Callout>

      {/* 1. OWNERS */}
      <H2 id="owners">1. WhatsApp का असली मालिक कौन है</H2>
      <P>
        WhatsApp कोई स्वतंत्र कंपनी नहीं है। 19 फ़रवरी 2014 को Facebook (आज Meta
        Platforms, Inc.) ने WhatsApp Inc. को क़रीब{" "}
        <strong>$19 अरब (US $19 billion)</strong> में ख़रीदने की घोषणा की — $4
        बिलियन कैश, $12 बिलियन Facebook स्टॉक, और लगभग $3 बिलियन के RSU जो चार
        साल में vest हुए।<S ids={[51, 52, 53]} /> उस समय WhatsApp में सिर्फ़ क़रीब{" "}
        <strong>55 कर्मचारी</strong> थे और 45 करोड़ मासिक सक्रिय यूज़र — यानि
        प्रति कर्मचारी क़रीब $34.5 करोड़, जो प्रति-हेड के हिसाब से सॉफ़्टवेयर
        इतिहास का सबसे महँगा अधिग्रहण था।<S ids={[51, 52, 53]} />
      </P>
      <P>
        यह मालिकाना हक़ इसलिए मायने रखता है क्योंकि उसी Meta परिवार के अंदर 2018
        का Cambridge Analytica काण्ड हुआ — जिसमें क़रीब <strong>8.7 करोड़</strong>{" "}
        Facebook यूज़र्स का व्यक्तिगत डेटा बिना उनकी सहमति के एक राजनैतिक
        सलाहकार कंपनी तक पहुँचा, और जिसके चलते 2019 में अमेरिकी FTC ने Facebook
        पर $5 बिलियन का रिकॉर्ड जुर्माना लगाया।<S ids={[61]} /> WhatsApp की
        इंजीनियरिंग टीम चाहे जितनी अच्छी हो, ज़िम्मेदारी की चेन उसी पैरेंट कंपनी
        तक जाती है जिसके डेटा-दुरुपयोग का इतिहास दर्ज है।
      </P>

      {/* 2. FOUNDERS */}
      <H2 id="founders">
        2. खुद इसके फ़ाउंडर ही प्राइवेसी पर लड़कर निकले
      </H2>
      <P>
        WhatsApp को 2009 में दो लोगों ने मिलकर शुरू किया —{" "}
        <strong>Jan Koum</strong>, यूक्रेन में जन्मे एक इमिग्रेंट जो अमेरिका में
        फ़ूड स्टैम्प पर पले, और <strong>Brian Acton</strong>। Koum ने अपनी डेस्क
        पर हाथ से लिखा एक नोट चिपका रखा था जो उन्हें हमेशा दिखता था: “No Ads! No
        Games! No Gimmicks!” — कोई विज्ञापन नहीं, कोई गेम नहीं, कोई चालाकी नहीं।<S ids={[53, 54, 58]} />
      </P>
      <P>
        यह वादा Facebook के अधिग्रहण के सिर्फ़ चार साल चला। 20 मार्च 2018 को —
        जब Cambridge Analytica काण्ड चरम पर था — Brian Acton ने अधिग्रहण के बाद
        की अपनी चुप्पी तोड़ी और लिखा: <em>“It is time. #deletefacebook”</em>।
        उस समय तक Acton कंपनी छोड़ चुके थे, और लगभग <strong>$85 करोड़ ($850
        मिलियन)</strong> के unvested Facebook स्टॉक को छोड़ने का फ़ैसला कर चुके
        थे — क्योंकि उन्हें कंपनी की दिशा से असहमति थी।<S ids={[55, 58]} />
      </P>
      <Quote cite="Forbes / Fortune – Brian Acton का ट्वीट, मार्च 2018 [55]">
        It is time. #deletefacebook.
      </Quote>
      <P>
        उसके छह हफ़्ते बाद, 30 अप्रैल 2018, Jan Koum ने भी Meta छोड़ने और
        Facebook बोर्ड से इस्तीफ़ा देने की घोषणा कर दी। <em>The Washington Post</em>{" "}
        ने रिपोर्ट किया कि Koum का इस्तीफ़ा Facebook नेतृत्व के साथ चौड़े मतभेदों
        के बाद हुआ — WhatsApp यूज़र्स के डेटा के इस्तेमाल पर, Facebook द्वारा
        WhatsApp के end-to-end एन्क्रिप्शन को कमज़ोर करने की कोशिशों पर, और
        WhatsApp में विज्ञापन शुरू करने की योजना पर।<S ids={[56, 57]} />
      </P>
      <Callout tone="danger" title="WhatsApp के दोनों फ़ाउंडर प्राइवेसी पर निकले">
        दो अरबपति, जिनके पास मिलाकर एक अरब डॉलर से ऊपर का unvested स्टॉक था,
        अपनी ही बनाई कंपनी से बाहर निकल गए — सिर्फ़ इसलिए कि वे वो नहीं बनाना
        चाहते थे जो Meta WhatsApp के डेटा से करना चाहता था। 2021 की पॉलिसी,
        Business के लिए Cloud API, 2025 के विज्ञापन — यह सब वही है जो फ़ाउंडर
        बनाने से इनकार कर रहे थे।<S ids={[55, 56, 57, 58]} />
      </Callout>

      {/* 3. POLICY */}
      <H2 id="policy">3. प्राइवेसी पॉलिसी असल में क्या कहती है</H2>
      <P>
        इस पूरी पड़ताल का सबसे ज़रूरी दस्तावेज़ वही है जो लगभग कोई नहीं पढ़ता —
        WhatsApp की अपनी प्राइवेसी पॉलिसी।<S ids={[1, 2]} /> WhatsApp ख़ुद मानता
        है कि वह नीचे लिखी जानकारी इकट्ठा करता है:
      </P>
      <H3>3.1 जो आप ख़ुद देते हैं</H3>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>आपका मोबाइल नंबर (अनिवार्य)।<S ids={[1, 2]} /></li>
        <li>आपका प्रोफ़ाइल नाम, फ़ोटो और “About” टेक्स्ट।<S ids={[1, 2]} /></li>
        <li>आपकी पूरी कॉन्टैक्ट लिस्ट — उन लोगों के नंबर भी जो WhatsApp इस्तेमाल नहीं करते।<S ids={[1, 4, 47]} /></li>
        <li>आपके Status, Channels और Communities का कंटेंट।<S ids={[6, 7]} /></li>
        <li>WhatsApp Pay या Business पेमेंट से जुड़ी जानकारी।<S ids={[1]} /></li>
        <li>customer support या feedback में दी गई हर जानकारी।<S ids={[1, 2]} /></li>
      </ul>
      <H3>3.2 जो ऐप ख़ुद-ब-ख़ुद इकट्ठा करता है</H3>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>आपका डिवाइस मॉडल, OS, बैटरी लेवल, सिग्नल स्ट्रेंथ, ऐप वर्शन, ब्राउज़र, मोबाइल नेटवर्क, MCC/MNC आदि।<S ids={[1, 2]} /></li>
        <li>IP एड्रेस, भाषा, टाइम ज़ोन और अनुमानित लोकेशन (बिना GPS के भी)।<S ids={[1, 2, 45]} /></li>
        <li>डिवाइस ID, advertising ID, ब्राउज़र ID, कुकीज़।<S ids={[1, 2]} /></li>
        <li>आप कौन सा फ़ीचर कितनी बार, कब, कितनी देर, और किसके साथ इस्तेमाल करते हैं — यह सब लॉग।<S ids={[1, 2, 45]} /></li>
        <li>क्रैश रिपोर्ट, ऐप लॉग और परफ़ॉर्मेंस डेटा।<S ids={[1, 2]} /></li>
      </ul>
      <H3>3.3 दूसरी Meta कंपनियों के साथ क्या शेयर होता है</H3>
      <Quote cite="WhatsApp Help Center [3]">
        We share information with other Meta companies to, for example, help
        operate, provide, improve, understand, customize, support and market our
        Services and their offerings.
      </Quote>
      <P>
        अनुवाद: हम बाक़ी Meta कंपनियों के साथ जानकारी इस लिए शेयर करते हैं कि
        सेवाएँ चलाना, सुधारना, समझना, कस्टमाइज़ करना, सपोर्ट देना और बाज़ार में
        उतारना मुमकिन हो। साझा होने वाली श्रेणियों में आपका फ़ोन नंबर, ट्रांज़ैक्शन
        डेटा, सर्विस-संबंधी जानकारी, आप दूसरों (और बिज़नेस) से कैसे बात करते हैं
        इसकी जानकारी, मोबाइल डिवाइस की जानकारी और IP एड्रेस शामिल हैं।<S ids={[1, 3]} />
      </P>
      <Callout tone="warn" title="E2EE होने के बावजूद यह क्यों मायने रखता है">
        End-to-end एन्क्रिप्शन सिर्फ़ मैसेज की <em>सामग्री</em> छुपाता है। ऊपर
        दी गई पूरी सूची — फ़ोन नंबर, कॉन्टैक्ट, IP, डिवाइस, यूसेज, किससे और कब
        बात की — Meta के सर्वर पर साफ़-साफ़ मौजूद है, क्योंकि यह डेटा Meta खुद
        बनाता और स्टोर करता है।<S ids={[1, 17, 45]} />
      </Callout>

      {/* 4. METADATA */}
      <H2 id="metadata">4. मेटाडेटा — एन्क्रिप्शन जो छुपा नहीं सकता</H2>
      <P>
        WhatsApp के मार्केटिंग का बड़ा सहारा है वह ताला (lock) आइकन और लाइन —
        “मैसेज और कॉल end-to-end एन्क्रिप्टेड हैं। इस चैट के बाहर कोई भी, यहाँ तक
        कि WhatsApp भी, इन्हें नहीं पढ़ सकता।” यह बात सच है। पर इसका दायरा बहुत
        छोटा है।<S ids={[4]} />
      </P>
      <P>
        E2EE सिर्फ़ <em>मैसेज की सामग्री</em> को छुपाता है — आपने जो लिखा,
        जो फ़ोटो भेजी, कॉल की आवाज़। यह उस <em>लिफ़ाफ़े</em> को नहीं छुपाता —
        यह बात कि आपने इस नंबर से उस नंबर पर, इस वक़्त, इस IP से, इस डिवाइस से,
        इस Wi-Fi या टावर से मैसेज किया।<S ids={[1, 2, 17, 45]} />
      </P>
      <P>
        2021 में Rolling Stone ने FBI का एक लीक हुआ ट्रेनिंग दस्तावेज़ छापा। उस
        दस्तावेज़ के अनुसार, सही क़ानूनी आदेश पर WhatsApp basic subscriber रिकॉर्ड,
        टार्गेट की कॉन्टैक्ट लिस्ट, और टार्गेट को जिनकी कॉन्टैक्ट लिस्ट में रखा
        गया है उन सबकी जानकारी दे सकता है — और साथ ही pen-register जैसी जानकारी
        — हर मैसेज का source और destination IP — <em>लगभग रीयल-टाइम</em> में।<S ids={[17]} />
      </P>
      <Quote cite="FBI दस्तावेज़, Rolling Stone द्वारा प्रकाशित, दिसंबर 2021 [17]">
        WhatsApp produces certain metadata pursuant to a pen register; message
        sender and receiver source and destination IP addresses … are returned
        in near real time.
      </Quote>
      <P>
        तुलना के लिए: उसी FBI दस्तावेज़ में Signal के बारे में लिखा है कि वह
        ज़्यादा से ज़्यादा सिर्फ़ अकाउंट बनने की तारीख़ और आख़िरी कनेक्शन की
        तारीख़ देता है — और कुछ नहीं।<S ids={[17]} />
      </P>

      {/* 5. 2021 */}
      <H2 id="y2021">5. 2021 की ज़बरदस्ती वाली पॉलिसी</H2>
      <P>
        4 जनवरी 2021 को WhatsApp ने ऐप के अंदर एक नोटिस भेजा कि 8 फ़रवरी तक नई
        पॉलिसी मानो, वरना ऐप काम करना बंद कर देगा।<S ids={[5, 31, 32]} /> 2016 की
        पुरानी पॉलिसी में यूज़र को Facebook के साथ कुछ डेटा शेयरिंग से opt-out
        करने का एकबार-का विकल्प मिला था। 2021 में वही विकल्प ही हटा दिया गया।<S ids={[31, 32, 43]} />
      </P>
      <P>
        प्रतिक्रिया तुरंत आई — करोड़ों लोगों ने Signal और Telegram डाउनलोड कर
        लिए। ACM CHI में प्रकाशित peer-reviewed शोध ने इस वैश्विक shift को
        मापा।<S ids={[43]} /> WhatsApp ने अख़बार में विज्ञापन देकर सफ़ाई दी और
        deadline को 15 मई 2021 तक बढ़ाया।<S ids={[5, 31]} />
      </P>
      <P>
        बदलाव का असली पदार्थ था (a) Business अकाउंट से बात करते समय डेटा का बहाव,
        जिसमें Facebook की होस्टिंग शामिल हो सकती थी, और (b) WhatsApp का Meta
        परिवार में और गहरा एकीकरण।<S ids={[5, 32, 33]} /> यही 2021 का update है
        जिसके चलते भारत के CCI ने केस दर्ज किया (देखें §16) और आयरलैंड के DPC ने
        €225 मिलियन का जुर्माना ठोका (देखें §16)।<S ids={[27, 28, 29, 30, 31]} />
      </P>

      {/* 6. BACKUPS */}
      <H2 id="backups">6. क्लाउड बैकअप की कमज़ोरी</H2>
      <P>
        मान लीजिए WhatsApp का E2EE सौ टका सही है। फिर भी एक खुली खिड़की है —
        बैकअप।
      </P>
      <P>
        WhatsApp आपके फ़ोन के बैकअप को आपके क्लाउड (Android पर Google Drive,
        iPhone पर iCloud) में रखता है। 2021 तक ये बैकअप end-to-end एन्क्रिप्टेड{" "}
        <em>थे ही नहीं</em> — आपके हर मैसेज की एक copy आपके cloud अकाउंट में
        सादे रूप में पड़ी थी, और सही क़ानूनी आदेश पर Apple/Google को दी जा सकती
        थी।<S ids={[8, 9, 10]} />
      </P>
      <P>
        अक्टूबर 2021 में WhatsApp ने एक <em>वैकल्पिक</em> end-to-end एन्क्रिप्टेड
        बैकअप फ़ीचर लॉन्च किया। यूज़र को इसे ख़ुद चालू करना पड़ता है, और 64-अंकों
        की एक encryption key याद रखनी पड़ती है (या password सेट करना पड़ता है, और
        भूलने पर बैकअप हमेशा के लिए चला गया)।<S ids={[8, 9, 10]} /> WhatsApp ने
        कभी नहीं कहा कि E2EE backup डिफ़ॉल्ट है।<S ids={[8]} />
      </P>
      <Callout tone="danger" title="असल में होता क्या है">
        ज़्यादातर WhatsApp यूज़र, जो cloud backup चालू रखते हैं, अपनी पूरी चैट
        हिस्ट्री की एक indexable, plain-text copy Apple या Google को दे रहे हैं
        — और इस तरह उस हर सरकार को, जो इन कंपनियों पर क़ानूनी दबाव डाल सके।<S ids={[9, 10]} />
      </Callout>

      {/* 7. BUSINESS */}
      <H2 id="business">7. WhatsApp Business — जहाँ E2EE चुपचाप ख़त्म होता है</H2>
      <P>
        आज WhatsApp चैट का “दूसरा छोर” अक्सर इंसान नहीं होता — एयरलाइन, बैंक,
        डिलीवरी कंपनी, हॉस्पिटल या सरकारी ऑफ़िस होता है, जो Meta के Business
        Platform / Cloud API से जुड़ा है।<S ids={[46]} />
      </P>
      <P>
        जब आप ऐसे बिज़नेस को मैसेज करते हैं जो Meta-hosted Cloud API पर है, तो
        आपका मैसेज आपके फ़ोन से Cloud API endpoint तक एन्क्रिप्टेड जाता है — पर
        वहाँ <strong>Meta ख़ुद उस मैसेज को decrypt करता है</strong> और बिज़नेस
        को देता है, जो उसे अपनी पॉलिसी के अनुसार स्टोर/लॉग/शेयर कर सकता है।<S ids={[46]} />
      </P>
      <Quote cite="Meta for Developers — WhatsApp Cloud API: Data privacy & security [46]">
        With the Cloud API hosted by Meta, the encryption layer between
        WhatsApp users and the business has its endpoint at the Cloud API. As
        the host of the Cloud API endpoint, Meta is a third party in the
        conversation between a WhatsApp user and a business.
      </Quote>
      <P>
        सरल हिंदी में: बिज़नेस से बात करते समय Meta बीच में बैठा तीसरा पक्ष होता
        है। ज़्यादातर यूज़र को यह कभी नहीं बताया गया।<S ids={[46]} />
      </P>

      {/* 8. ADS */}
      <H2 id="ads">8. WhatsApp के अंदर विज्ञापन (जून 2025)</H2>
      <P>
        WhatsApp का दशकों पुराना वादा था — “कोई विज्ञापन नहीं।” यह वादा 16 जून
        2025 को Cannes Lions में सार्वजनिक रूप से टूट गया, जब Meta ने Updates
        टैब में विज्ञापन शुरू करने की घोषणा की।<S ids={[11, 12, 13]} />
      </P>
      <Quote cite="Meta Newsroom, 16 जून 2025 [11]">
        Today, we're announcing new updates to make it easier for you to
        discover and follow channels and businesses on WhatsApp, including
        channel subscriptions, promoted channels and ads in Status — all in the
        Updates tab.
      </Quote>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li><strong>Status में विज्ञापन</strong> — आपके फ़ॉलो किए गए Status के बीच फ़ुल-स्क्रीन ऐड।<S ids={[11, 12, 13]} /></li>
        <li><strong>Promoted Channels</strong> — पैसा देकर ऊपर दिखने वाले चैनल।<S ids={[11, 13]} /></li>
        <li><strong>Channel subscriptions</strong> — एक्सक्लूसिव कंटेंट के लिए पेड चैनल।<S ids={[11, 13]} /></li>
      </ul>
      <P>
        Meta का दावा है कि ये ads आपके मैसेज नहीं पढ़ेंगे (क्योंकि Meta पढ़ ही
        नहीं सकता), पर वे आपके देश, भाषा, फ़ॉलो किए गए चैनल और ad-इंटरैक्शन जैसे
        सिग्नलों का इस्तेमाल करेंगे — यानि वही मेटाडेटा-स्टैक जो §3 और §4 में
        है।<S ids={[11, 12]} />
      </P>

      {/* 9. AI */}
      <H2 id="ai">9. आपकी चैट लिस्ट में Meta AI</H2>
      <P>
        2024 में Meta ने अपना AI Assistant सीधे WhatsApp के interface में जोड़
        दिया — ज़्यादातर देशों में यह आपकी चैट लिस्ट में एक स्थायी contact के
        रूप में दिखता है, जिसे हटाया नहीं जा सकता।<S ids={[91, 92]} /> Meta ने
        स्वीकार किया है कि Meta AI को भेजे गए prompts Meta पर process होते हैं
        और model को बेहतर करने में इस्तेमाल हो सकते हैं, और Meta AI को forward
        किए गए मैसेज E2EE लिफ़ाफ़े से बाहर निकल जाते हैं।<S ids={[91]} />
      </P>
      <P>
        अप्रैल 2025 में EU ने जाँच शुरू की कि Meta का यह दावा कि E2EE Meta को
        चैट से बाहर रखता है, उस ability से कैसे मेल खाता है कि Meta चैट के
        अंदर AI prompts process कर सकता है — यह सवाल अभी हल नहीं हुआ।<S ids={[48]} />
      </P>

      {/* 10. LAW */}
      <H2 id="law">10. सरकारें और क़ानून-व्यवस्था</H2>
      <P>
        Meta का Law Enforcement Response Team सरकारी अनुरोधों को संभालता है।<S ids={[14, 15, 16]} /> सही क़ानूनी आदेश पर WhatsApp यह दे सकता है:
      </P>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>Basic subscriber रिकॉर्ड — फ़ोन नंबर, अकाउंट कब बना, last seen, डिवाइस की जानकारी।<S ids={[14, 15, 17]} /></li>
        <li>टार्गेट की कॉन्टैक्ट लिस्ट और जिनकी कॉन्टैक्ट लिस्ट में टार्गेट है, यानि उसका सोशल ग्राफ़।<S ids={[17]} /></li>
        <li>Pen-register आदेश पर हर मैसेज का source/destination IP, लगभग रीयल टाइम — WhatsApp Web/Desktop सहित।<S ids={[17]} /></li>
        <li>अगर बैकअप एन्क्रिप्टेड नहीं है, तो content cloud provider से सीधे लिया जा सकता है।<S ids={[8, 9, 10, 17]} /></li>
      </ul>
      <P>
        जो WhatsApp <em>नहीं</em> दे सकता वह है — रास्ते में चल रहे
        end-to-end एन्क्रिप्टेड मैसेज की content।<S ids={[14, 15]} /> यह एक
        असली सुरक्षा है — पर FBI के दस्तावेज़ साफ़ कहते हैं कि जाँचकर्ताओं को
        सबसे ज़्यादा metadata चाहिए, content नहीं।<S ids={[16, 17]} />
      </P>

      {/* 11. PEGASUS */}
      <H2 id="pegasus">11. Pegasus — $167M का NSO फ़ैसला</H2>
      <P>
        मई 2019 में WhatsApp को पता चला कि उसके voice-call फ़ीचर पर एक हमला हो
        रहा है — हमलावर एक कॉल करता था, और जवाब न मिलने पर भी{" "}
        <strong>CVE-2019-3568</strong> का इस्तेमाल कर NSO Group का Pegasus
        spyware डिवाइस पर डाल देता था।<S ids={[19, 21, 33, 40]} /> WhatsApp ने
        लगभग 20 देशों में 1,400 से ज़्यादा टार्गेट पहचाने — पत्रकार, मानवाधिकार
        कार्यकर्ता, वकील, अकादमिक, राजनयिक और विपक्षी नेता।<S ids={[19, 20, 21, 22, 41, 42]} />
      </P>
      <P>
        छह साल की क़ानूनी लड़ाई के बाद, 6 मई 2025 को कैलिफ़ोर्निया की federal
        jury ने NSO Group पर WhatsApp/Meta को{" "}
        <strong>$167.25 मिलियन का दंडात्मक जुर्माना</strong> और लगभग $4,44,000
        का compensatory जुर्माना सुनाया।<S ids={[18, 19, 20, 21, 22]} /> कोर्ट
        दस्तावेज़ों से पता चला कि NSO ने अंदरूनी रूप से एक “WhatsApp
        Installation Server” बना रखा था, ख़ासतौर पर WhatsApp के infrastructure
        को उसके अपने यूज़र्स के विरुद्ध इस्तेमाल करने के लिए।<S ids={[19, 22]} />
      </P>
      <Quote cite="Amnesty International, मई 2025 [20]">
        Today's ruling against NSO Group is a momentous win in the fight
        against spyware abuse and a critical step in protecting human rights
        defenders, journalists and civil society from unlawful surveillance.
      </Quote>

      {/* 12. VICTIMS */}
      <H2 id="victims">12. Pegasus के शिकार, देश-दर-देश</H2>
      <P>
        दो बड़ी जाँचों ने इसका नक़्शा बनाया — Citizen Lab की 2018 की रिपोर्ट{" "}
        <em>Hide and Seek</em>, और 2021 का <strong>Pegasus Project</strong>{" "}
        (10 देशों के 17 मीडिया संगठनों का गठजोड़, Forbidden Stories और Amnesty
        Security Lab के साथ)। दोनों ने मिलकर साबित किया कि Pegasus कम-से-कम 45
        देशों में इस्तेमाल हुआ, और एक लीक हुई 50,000+ नंबरों की सूची मिली जिन
        पर NSO के क्लाइंट्स ने निगरानी का चयन किया था।<S ids={[81, 82, 83]} />
      </P>
      <H3>12.1 सऊदी अरब — Khashoggi और Bezos</H3>
      <P>
        Jamal Khashoggi, <em>The Washington Post</em> के स्तंभकार और सऊदी
        क्राउन प्रिंस मोहम्मद बिन सलमान के मुखर आलोचक, की 2 अक्टूबर 2018 को
        इस्तांबुल स्थित सऊदी consulate में हत्या कर दी गई।<S ids={[75, 76]} />{" "}
        फ़ोरेंसिक जाँच ने बाद में पाया कि Khashoggi की पत्नी{" "}
        <strong>Hanan Elatr</strong> के फ़ोन पर हत्या से कुछ महीने पहले UAE की
        एक एजेंसी ने Pegasus डाला था, और हत्या के कुछ ही दिनों बाद उनकी मंगेतर
        Hatice Cengiz का फ़ोन भी संक्रमित था।<S ids={[75, 76]} />
      </P>
      <P>
        अलग से, मई 2018 में Amazon के संस्थापक{" "}
        <strong>Jeff Bezos</strong> का फ़ोन — FTI Consulting की 2019 की
        फ़ोरेंसिक रिपोर्ट के अनुसार — मोहम्मद बिन सलमान द्वारा निजी रूप से
        इस्तेमाल किए गए WhatsApp अकाउंट से भेजी गई एक MP4 video फ़ाइल के ज़रिए
        “संभवतः infiltrated” हुआ। बाद में UN ने इसकी जाँच की माँग की।<S ids={[73, 74]} />
      </P>
      <H3>12.2 भारत — कम-से-कम 121 WhatsApp टार्गेट, बाद में 300+</H3>
      <P>
        30 अक्टूबर 2019 को WhatsApp ने स्वीकार किया कि भारत में लगभग{" "}
        <strong>121 यूज़र्स</strong> उसी WhatsApp Pegasus exploit
        (CVE-2019-3568) से निशाना बनाए गए थे। दो साल बाद Pegasus Project ने
        300+ भारतीय फ़ोन नंबरों की एक सूची जारी की, जिन पर निगरानी का चयन हुआ
        था — Indian Express, The Hindu, Hindustan Times और The Wire के
        पत्रकार, मौजूदा कैबिनेट मंत्री, विपक्षी नेता, चुनाव आयोग के स्टाफ और
        Supreme Court के लोग शामिल।<S ids={[71, 72]} /> Supreme Court ने एक
        स्वतंत्र तकनीकी समिति बैठाई; जिसने 2022 में रिपोर्ट दी कि वह पुष्टि
        या इनकार नहीं कर पा रही — एक हिस्से में इसलिए कि भारत सरकार ने सहयोग
        नहीं किया।<S ids={[72]} />
      </P>
      <H3>12.3 मेक्सिको — निगरानी और एक मारा गया पत्रकार</H3>
      <P>
        मेक्सिको NSO Group का पहला पुष्ट सरकारी क्लाइंट था। 2017 में Citizen Lab
        ने मेक्सिकन पत्रकारों, वकीलों और भ्रष्टाचार-विरोधी कार्यकर्ताओं पर
        Pegasus का इस्तेमाल दर्ज किया। Pegasus Project ने बाद में बताया कि
        freelance crime reporter <strong>Cecilio Pineda Birto</strong> का फ़ोन
        उनकी 2 मार्च 2017 की हत्या से कुछ ही हफ़्ते पहले निगरानी के लिए चुना
        गया था।<S ids={[76, 77, 80, 82]} />
      </P>
      <H3>12.4 UAE — Ahmed Mansoor</H3>
      <P>
        2016 में Citizen Lab ने पहली बार Pegasus को सार्वजनिक रूप से UAE के
        मानवाधिकार रक्षक <strong>Ahmed Mansoor</strong> पर इस्तेमाल होते दिखाया।<S ids={[40, 78, 79]} /> Mansoor को मार्च 2017 में गिरफ़्तार किया गया,
        2018 में सोशल मीडिया पोस्ट के लिए 10 साल की सज़ा दी गई, और मार्च 2025 में
        UAE ने उन पर 15 साल की सज़ा बरक़रार रखी।<S ids={[78, 79]} />
      </P>
      <H3>12.5 स्पेन — CatalanGate</H3>
      <P>
        अप्रैल 2022 में Citizen Lab ने Catalan स्वतंत्रता आंदोलन से जुड़े{" "}
        <strong>कम-से-कम 65 लोगों</strong> पर Pegasus और Candiru का इस्तेमाल
        दर्ज किया — चुने हुए नेता, वकील, सिविल सोसाइटी और परिजन शामिल। Citizen
        Lab ने इसे “रिकॉर्ड पर सबसे बड़ा फ़ोरेंसिक रूप से दर्ज cluster” बताया।<S ids={[80]} />
      </P>
      <H3>12.6 दूसरे देश</H3>
      <P>
        Citizen Lab की 2018 की <em>Hide and Seek</em> रिपोर्ट ने Pegasus को
        कम-से-कम 45 देशों में पाया — अल्जीरिया, बहरीन, बांग्लादेश, ब्राज़ील,
        कनाडा, मिस्र, फ़्रांस, ग्रीस, हंगरी, भारत, इराक़, इज़रायल, जॉर्डन,
        कज़ाकिस्तान, केन्या, कुवैत, लातविया, लेबनान, लीबिया, मेक्सिको, मोरक्को,
        ओमान, पाकिस्तान, फ़िलिस्तीन, पोलैंड, क़तर, रवांडा, सऊदी अरब, सिंगापुर,
        दक्षिण अफ़्रीका, स्विट्ज़रलैंड, थाईलैंड, टोगो, ट्यूनिशिया, तुर्की, UAE,
        युगांडा, UK, US, उज़बेकिस्तान, यमन और ज़ाम्बिया।<S ids={[83]} /> इनमें
        से कई में WhatsApp डिलीवरी का मुख्य ज़रिया था।
      </P>

      {/* 13. PARAGON */}
      <H2 id="paragon">13. Paragon Graphite (2025)</H2>
      <P>
        जनवरी 2025 के अंत में WhatsApp ने सार्वजनिक रूप से बताया कि लगभग{" "}
        <strong>90 यूज़र्स</strong> — पत्रकार और सिविल सोसाइटी के लोग —
        इज़रायली कंपनी Paragon Solutions के Graphite spyware का निशाना बने,
        एक zero-click तरीक़े से जिसने WhatsApp का इस्तेमाल किया।<S ids={[24, 25]} />
      </P>
      <P>
        Citizen Lab ने इटली में iOS पर पहली बार फ़ोरेंसिक पुष्टि की — कई
        पत्रकार और एक प्रवासी-बचाव NGO के executive के फ़ोन प्रभावित थे।<S ids={[23, 25, 26]} />
      </P>
      <Callout tone="danger" title="यह pattern है, सिर्फ़ bug नहीं">
        Pegasus और Graphite अलग कंपनियों के अलग product हैं — पर pattern एक
        ही है: ऊँचे टार्गेट + WhatsApp + zero-click exploit + ख़रीदार के लिए
        plausible deniability। 3+ अरब यूज़र्स वाला WhatsApp आज दुनिया का सबसे
        आकर्षक surface है।<S ids={[20, 22, 25, 26]} />
      </Callout>

      {/* 14. LEAKS */}
      <H2 id="leaks">14. लीक, बग और टूटे हुए फ़ीचर</H2>
      <H3>14.1 Link-preview से IP और content का लीक (2020)</H3>
      <P>
        अक्टूबर 2020 में Talal Haj Bakry और Tommy Mysk ने रिसर्च प्रकाशित की कि
        कई बड़े मैसेजिंग ऐप्स के link-preview फ़ीचर यूज़र का IP लीक कर सकते हैं,
        बैकग्राउंड में बड़ी फ़ाइलें डाउनलोड कर सकते हैं, और E2EE चैट में भेजे
        लिंक का हिस्सा सर्वर-साइड preview generator तक पहुँचा सकते हैं।<S ids={[36, 37]} />
      </P>
      <H3>14.2 “View Once” — चार बार तोड़ा गया</H3>
      <P>
        Tal Be'ery और Zengo X रिसर्च टीम ने सार्वजनिक रूप से कम-से-कम{" "}
        <strong>चार अलग-अलग तरीक़े</strong> दिखाए हैं जिनसे WhatsApp के “View
        Once” फ़ीचर को bypass किया जा सकता है। SecurityWeek ने 2024 में रिपोर्ट
        किया कि चौथे bypass के बाद Meta ने कहा कि underlying issue patch नहीं
        करेगी।<S ids={[85, 86, 87]} />
      </P>
      <H3>14.3 Click-to-chat से फ़ोन नंबर Google पर (2020)</H3>
      <P>
        रिसर्चर Athul Jayaram ने दिखाया कि WhatsApp के “Click to Chat” फ़ीचर ने
        ऐसे public URLs बनाए जिनमें यूज़र के फ़ोन नंबर साफ़ टेक्स्ट में थे —
        और Google इन्हें index कर रहा था, यानि कोई भी एक सामान्य Google search से
        WhatsApp यूज़र्स के नंबर ढूँढ सकता था।<S ids={[33]} />
      </P>

      {/* 15. 2022 LEAK */}
      <H2 id="leak2022">15. 2022 का 48.7 करोड़ नंबरों का लीक</H2>
      <P>
        16 नवंबर 2022 को 84 देशों के लगभग{" "}
        <strong>48.7 करोड़ (487 मिलियन) WhatsApp यूज़र्स के सक्रिय मोबाइल
        नंबरों</strong> का dataset Breached.vc हैकिंग फ़ोरम पर बिक्री के लिए
        डाला गया।<S ids={[59, 60]} /> Cybernews ने sample से data verify किया।<S ids={[59]} /> सबसे बड़ा हिस्सा मिस्र (~4.5 करोड़), इटली (~3.5
        करोड़), अमेरिका (~3.2 करोड़), सऊदी अरब (~2.9 करोड़), फ़्रांस (~2 करोड़),
        तुर्की (~2 करोड़) और UK (~1.1 करोड़) का था।<S ids={[59, 60]} />
      </P>
      <P>
        बेचने वाले का दावा था कि data scrape किया गया है; WhatsApp ने
        characterisation पर सवाल उठाया, पर इस बात से इनकार नहीं किया कि नंबर
        live WhatsApp अकाउंट्स के थे।<S ids={[59, 60]} />
      </P>

      {/* 16. FINES */}
      <H2 id="fines">16. नियामक जुर्माने और रोक</H2>
      <H3>16.1 आयरलैंड — €225 मिलियन GDPR जुर्माना (2021)</H3>
      <P>
        2 सितंबर 2021 को आयरलैंड के Data Protection Commission ने WhatsApp
        Ireland Ltd पर <strong>€225 मिलियन</strong> का GDPR जुर्माना लगाया।<S ids={[27, 28]} /> जाँच दिसंबर 2018 में शुरू हुई थी और निष्कर्ष था कि
        WhatsApp ने GDPR की पारदर्शिता-संबंधी ज़िम्मेदारियों का उल्लंघन किया —
        यानि उसने यूज़र्स (और गैर-यूज़र्स जिनके नंबर friends की कॉन्टैक्ट लिस्ट
        में चले गए) को साफ़-साफ़ नहीं बताया कि उनके data के साथ क्या हो रहा है।<S ids={[27, 28]} />
      </P>
      <H3>16.2 भारत — ₹213 करोड़ जुर्माना + 5 साल का data-शेयर बैन (2024)</H3>
      <P>
        18 नवंबर 2024 को CCI ने Meta पर <strong>₹213.14 करोड़</strong> का
        जुर्माना लगाया और WhatsApp को 5 साल के लिए advertising के मक़सद से data
        अन्य Meta कंपनियों को न देने का आदेश दिया।<S ids={[29, 30, 31]} />
      </P>
      <P>
        4 नवंबर 2025 को NCLAT ने 5 साल के data-share बैन को रद्द कर दिया, पर
        ₹213 करोड़ का जुर्माना <em>क़ायम</em> रखा।<S ids={[29, 31]} /> Meta और
        WhatsApp Supreme Court में अपील कर चुके हैं; नवंबर 2025 में Supreme Court
        ने Meta को privacy breach पर सार्वजनिक रूप से फटकार लगाई।<S ids={[29, 31]} />
      </P>
      <H3>16.3 हैम्बर्ग, तुर्की और बाक़ी यूरोप</H3>
      <P>
        2021 की पॉलिसी के बाद जर्मनी की हैम्बर्ग DPA ने तीन महीनों के लिए
        Facebook (Meta) पर WhatsApp data के अतिरिक्त processing पर रोक का आदेश
        दिया।<S ids={[32, 49]} /> तुर्की के competition और data-protection
        authorities ने उसी महीने जाँच खोली; एर्दोगान के मीडिया ऑफ़िस ने सार्वजनिक
        रूप से WhatsApp छोड़कर तुर्की के BiP पर switch कर लिया।<S ids={[65, 66, 97]} /> मई 2023 में आयरलैंड के DPC ने Meta पर रिकॉर्ड €1.2 बिलियन
        का जुर्माना लगाया — आज तक का सबसे बड़ा GDPR जुर्माना।<S ids={[50]} />
      </P>

      {/* 17. BANS */}
      <H2 id="bans">17. देश-स्तर पर WhatsApp पर रोक</H2>
      <H3>17.1 चीन — 2017 से पूरी तरह बंद</H3>
      <P>
        WhatsApp चीन की Great Firewall पर पूरी तरह ब्लॉक है। 2017 की मध्य से
        voice/video calls धीमी हुईं और सितंबर 2017 तक टेक्स्ट मैसेज पर भी पूरा
        ब्लॉक लगा — आधिकारिक तौर पर इसलिए कि WhatsApp के E2EE की वजह से चीनी
        अधिकारी content देख नहीं पाते।<S ids={[62]} /> चीनी यूज़र्स को VPN
        चाहिए, जो ख़ुद चीन में क़ानूनी ग्रे-ज़ोन है।
      </P>
      <H3>17.2 ईरान — 2014 से बैन, 2024 के अंत में थोड़ी ढील</H3>
      <P>
        ईरान ने मई 2014 में WhatsApp को पहली बार बैन किया। आधिकारिक कारण ईरान
        के Committee for Determining Criminal Web Content के प्रमुख
        Abdolsamad Khorramabadi ने यह दिया कि WhatsApp Facebook का है, और
        Facebook Mark Zuckerberg ने बनाया है, जो “American Zionist” हैं।<S ids={[63]} /> 24 दिसंबर 2024 को ईरान ने आंशिक रूप से बैन हटाया, पर
        Meta ने सार्वजनिक रूप से कहा कि वह आज भी ईरानी सरकार की निगरानी
        कोशिशों को लेकर “चिंतित” है।<S ids={[64, 96]} />
      </P>
      <H3>17.3 ब्राज़ील — चार बार कोर्ट ने बंद करवाया (2015–2016)</H3>
      <P>
        फ़रवरी 2015 से जुलाई 2016 के बीच ब्राज़ील की अदालतों ने कम-से-कम चार
        बार WhatsApp को राष्ट्रीय स्तर पर अस्थायी रूप से बंद करवाया। मार्च
        2016 में Federal पुलिस ने Diego Dzodan, Facebook के Latin America VP, को
        ऑफ़िस आते समय गिरफ़्तार कर लिया, क्योंकि WhatsApp ने कोर्ट में कहा था
        कि वह जो messages वह नहीं रखता उन्हें दे नहीं सकता। उन्हें रात भर
        हिरासत में रखा गया, फिर ऊपरी अदालत ने रिहा किया।<S ids={[34, 35, 93, 94, 95]} />
      </P>
      <H3>17.4 तुर्की, रूस, सऊदी अरब, UAE</H3>
      <P>
        तुर्की के data-protection regulator ने 2021 की पॉलिसी पर औपचारिक जाँच
        की, उसी साल जुर्माना भी लगाया, और देश के सबसे बड़े टेलीकॉम operator
        ने एक स्थानीय विकल्प BiP लॉन्च किया जिसने एक हफ़्ते में 1 करोड़ से
        ज़्यादा यूज़र जोड़े।<S ids={[65, 66, 97]} /> रूस की Roskomnadzor
        WhatsApp पर खुले रूप से दुश्मनी रखती है।<S ids={[33]} /> सऊदी अरब और
        UAE ने ऐतिहासिक रूप से WhatsApp voice/video calls को ब्लॉक रखा (ताकि
        लोग सरकारी-licensed carriers से फ़ोन करें), जबकि उनकी अपनी एजेंसियाँ
        WhatsApp को बतौर attack surface इस्तेमाल करते पकड़ी गई हैं — Mansoor,
        Khashoggi का घेरा, Bezos।<S ids={[73, 74, 75, 78, 79]} />
      </P>

      {/* 18. LYNCH */}
      <H2 id="lynch">18. WhatsApp, फ़र्ज़ी ख़बरें और भारत में लिंचिंग</H2>
      <P>
        2017–2018 में भारत में WhatsApp groups पर वायरल हुई बच्चा-चोरी और
        अंग-व्यापार की अफ़वाहों की वजह से मॉब लिंचिंग की लहर चली। महाराष्ट्र,
        उत्तर प्रदेश, त्रिपुरा और अन्य राज्यों में लगभग 70 घटनाओं में
        कम-से-कम <strong>36 लोगों</strong> की मौत हुई।<S ids={[67, 68]} />
      </P>
      <P>
        भारत सरकार के लगातार दबाव में WhatsApp ने जुलाई 2018 में भारत में
        फ़ॉरवर्ड को <strong>5 चैट</strong> तक सीमित किया,<S ids={[69]} /> और
        अप्रैल 2020 में COVID-19 की मिसइन्फ़ॉर्मेशन के जवाब में globally नियम
        और कड़ा कर दिया — पहले से 5+ बार forward हो चुका कोई भी मैसेज एक बार में
        सिर्फ़ <strong>एक चैट</strong> को भेजा जा सकता है।<S ids={[70]} />
      </P>
      <Callout tone="warn" title="यह सिर्फ़ user की दिक़्क़त नहीं — platform की भी है">
        End-to-end एन्क्रिप्शन + 20 करोड़ से ज़्यादा यूज़र्स वाले देश में
        बिना-घर्षण के mass forwarding ने एक ऐसा सूचना-वातावरण बनाया जिसमें
        हिंसा भड़काने वाली अफ़वाहें किसी भी न्यूज़रूम या रेगुलेटर से तेज़
        फैलीं। मौतें WhatsApp की मंशा नहीं — पर इसकी architecture इसकी ज़िम्मेदार
        है।<S ids={[67, 68, 69, 70]} />
      </Callout>

      {/* 19. DELETE */}
      <H2 id="delete">19. “अकाउंट डिलीट” असल में क्या डिलीट करता है</H2>
      <P>
        WhatsApp की EEA Privacy Policy कहती है कि account delete करने पर वह आपकी
        जानकारी हटा देगा — सिवाय उन चीज़ों के जो पॉलिसी में बताई गई हैं।<S ids={[2]} /> Technical deletion में 90 दिन तक लग सकते हैं, और कुछ
        जानकारी (logs, abuse-prevention data, कुछ बैकअप) उसके बाद भी क़ानूनी,
        fraud-prevention और सुरक्षा कारणों से रखी जा सकती है।<S ids={[2, 44]} />
      </P>
      <P><em>आपका</em> account delete करने से ये नहीं हटतीं —</P>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>आपके भेजे messages/मीडिया जो दूसरों के फ़ोन पर सेव हैं।<S ids={[2, 44]} /></li>
        <li>आपका नंबर जो दूसरे लोगों की कॉन्टैक्ट लिस्ट में है, जिसे WhatsApp ने स्टोर कर रखा हो।<S ids={[1, 4]} /></li>
        <li>Channels/Communities/Status में डाली गई जानकारी।<S ids={[6, 7]} /></li>
        <li>आपके Google Drive/iCloud बैकअप — जिनकी पॉलिसी cloud provider की होती है, WhatsApp की नहीं।<S ids={[8, 9, 10]} /></li>
      </ul>

      {/* 20. SCAMS */}
      <H2 id="scams">20. औद्योगिक स्तर पर स्कैम</H2>
      <P>
        प्राइवेसी सिर्फ़ यह नहीं कि आपके messages कौन पढ़ रहा है — यह भी कि आप
        तक कौन पहुँच सकता है, आपका impersonation कौन कर सकता है, और आपका account
        कौन हाइजैक कर सकता है। Meta ने ख़ुद बताया कि सिर्फ़ 2025 की पहली छमाही
        में उसने <strong>68 लाख (6.8 मिलियन)</strong> WhatsApp accounts हटाए
        जो criminal scam centres से जुड़े थे — ज़्यादातर दक्षिण-पूर्व एशिया के
        scam compounds से।<S ids={[38, 39]} />
      </P>
      <P>
        भारत से लेकर ब्राज़ील और बेल्जियम तक — investment scam, romance scam,
        fake customer service, SIM-swap, OTP phishing से होने वाला नुक़सान तेज़ी
        से बढ़ रहा है।<S ids={[39]} />
      </P>

      {/* 21. VERDICT */}
      <H2 id="verdict">21. हाई-प्राइवेसी यूज़र के लिए नतीजा</H2>
      <P>
        शुरू में साफ़ कर देते हैं — WhatsApp malware नहीं है। आम user-to-user
        chat पर E2EE असली है, अच्छी तरह implement है (Signal Protocol पर बना है,
        जिसके मूल लेखक Open Whisper Systems के Moxie Marlinspike हैं<S ids={[89, 90]} />), और unencrypted SMS से कई गुना बेहतर। अगर आपका threat model
        सिर्फ़ इतना है — “पड़ोसी public Wi-Fi पर मेरा chat न पढ़े” — तो WhatsApp
        काम चला देता है।
      </P>
      <P>पर यह लेख दूसरे यूज़र के लिए है, जिसका threat model इनमें से कुछ शामिल करता है:</P>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>“मैं नहीं चाहता कि एक ही कंपनी मेरा behavioural profile बनाए — किससे, कब, कहाँ से बात की — और उसी से मुझे ad बेचे।”<S ids={[1, 11, 12, 17, 45]} /></li>
        <li>“मैं नहीं चाहता कि मेरा फ़ोन नंबर, contact graph और device fingerprint उसी कंपनी में पड़ा रहे जो Facebook/Instagram/Threads भी चलाती है।”<S ids={[1, 3, 27, 28, 29]} /></li>
        <li>“मैं नहीं चाहता कि मेरे messages की unencrypted plain-text copy ऐसे cloud में पड़ी रहे जिस पर subpoena पड़ सकता है।”<S ids={[8, 9, 10, 17]} /></li>
        <li>“मैं उस platform पर नहीं रहना चाहता जिसके चारों तरफ़ nation-state spyware companies पूरा product बना रही हैं।”<S ids={[18, 19, 20, 22, 23, 24, 25, 26]} /></li>
        <li>“मैं नहीं चाहता कि business को भेजे मेरे messages को Meta बीच में decrypt करे।”<S ids={[46]} /></li>
        <li>“जब मैं account delete करूँ — तो वह सच में delete हो, 90 दिन में, logs/बैकअप/दोस्तों के फ़ोन की copies/channel posts घटाकर नहीं।”<S ids={[2, 44]} /></li>
      </ul>
      <P>
        इस यूज़र के लिए WhatsApp structurally ग़लत tool है। इंजीनियर ख़राब नहीं हैं
        — वे बहुत अच्छे हैं — पर business model, parent company, क़ानूनी जोखिम और
        feature roadmap (ads, channels, business, AI) सभी उल्टी दिशा में खींच रहे
        हैं। Regulators ने यह कहा है। अदालतों ने कहा है। Mozilla की <em>Privacy
        Not Included</em> टीम ने कहा है। यहाँ तक कि WhatsApp के अपने founders ने
        जाते हुए कहा है।<S ids={[27, 28, 29, 30, 47, 55, 56, 57]} />
      </P>

      <Callout tone="info" title="VeilChat क्या अलग करता है">
        VeilChat उल्टी मान्यता पर बना है — कम-से-कम identity, कम-से-कम metadata,
        कोई ad नहीं, कोई पैरेंट कंपनी आपके social graph से पैसा नहीं बनाती,
        encrypted-by-default बैकअप, और कोई business inbox बीच में बैठकर हमारे
        सर्वर पर messages decrypt नहीं करता। हमारे शब्दों पर भरोसा करने की ज़रूरत
        नहीं — हमारा{" "}
        <Link to="/promises" className="text-[#2E6F40] underline">Promises</Link>{" "}
        पेज,{" "}
        <Link to="/what-we-store" className="text-[#2E6F40] underline">What We Store</Link>{" "}
        पेज और{" "}
        <Link to="/encryption" className="text-[#2E6F40] underline">Encryption</Link>{" "}
        पेज ख़ुद पढ़कर तय कीजिए।
      </Callout>
    </>
  );
}

/* ───────────────────────────── PAGE SHELL ───────────────────────────── */

export function WhatsappPrivacyPage() {
  const pct = useReadingProgress();
  const [lang, setLang] = useState<"en" | "hi">(() => {
    if (typeof window === "undefined") return "en";
    try {
      const saved = window.localStorage.getItem("veil:wa_blog_lang");
      if (saved === "en" || saved === "hi") return saved;
      // Default to Hindi for hi-* browsers, English otherwise.
      const nav = (navigator.language || "").toLowerCase();
      return nav.startsWith("hi") ? "hi" : "en";
    } catch {
      return "en";
    }
  });
  const readingMinutes = useMemo(() => (lang === "hi" ? 38 : 42), [lang]);

  useEffect(() => {
    try {
      window.localStorage.setItem("veil:wa_blog_lang", lang);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute("lang", lang === "hi" ? "hi" : "en");
  }, [lang]);

  useEffect(() => {
    const title =
      lang === "hi"
        ? "WhatsApp और आपकी प्राइवेसी — एक डॉक्युमेंट्री-स्तर की जाँच | VeilChat"
        : "WhatsApp & Privacy — A Documentary-Style Investigation | VeilChat";
    document.title = title;
    const desc =
      lang === "hi"
        ? "WhatsApp की प्राइवेसी पॉलिसी, terms, ads, सरकारी एक्सेस, spyware मामलों, क़ानूनी जुर्मानों और आपके data के साथ असल में क्या होता है — सब एक जगह, स्रोतों के साथ।"
        : "A long-form, fully-sourced investigation into WhatsApp's privacy policy, terms, ads plans, government access, spyware incidents, regulatory fines, and what really happens to your data.";
    let meta = document.querySelector('meta[name="description"]') as
      | HTMLMetaElement
      | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, [lang]);

  const tocItems = lang === "hi" ? TOC_HI : TOC_EN;

  const heroBadge = lang === "hi" ? "जाँच · पूर्ण स्रोत" : "Investigation · Fully sourced";
  const heroTitle =
    lang === "hi" ? (
      <>
        WhatsApp और आपकी प्राइवेसी:{" "}
        <span className="italic font-serif">वो क्या इकट्ठा करते हैं,</span>{" "}
        <span className="italic font-serif">कौन पढ़ता है,</span> और जब आप
        “delete” दबाते हैं तो{" "}
        <span className="italic font-serif">क्या असल में बच जाता है</span>।
      </>
    ) : (
      <>
        WhatsApp &amp; your privacy:{" "}
        <span className="italic font-serif">what they collect,</span>{" "}
        <span className="italic font-serif">who reads it,</span> and{" "}
        <span className="italic font-serif">what survives</span> when you hit
        “delete”.
      </>
    );
  const heroLead1 =
    lang === "hi"
      ? "तीन अरब लोग रोज़ WhatsApp पर मैसेज करते हैं। उन्हें बताया जाता है कि चैट end-to-end एन्क्रिप्टेड हैं — और हैं भी। पर end-to-end एन्क्रिप्शन एक बहुत बड़े सिस्टम के अंदर एक बहुत छोटा वादा है, और उस बड़े सिस्टम पर रेगुलेटर के जुर्माने, अदालतों के फ़ैसले, spyware के मुक़दमे और एक सार्वजनिक पॉलिसी विवाद हो चुके हैं — जिसमें करोड़ों यूज़र दूसरे ऐप्स पर चले गए।"
      : "Three billion people send messages on WhatsApp every day. They are told the chats are end-to-end encrypted — and they are. But end-to-end encryption is a small, narrow promise inside a much larger system, and that larger system has been the subject of regulator fines, court verdicts, spyware lawsuits, and a public policy fight that wiped tens of millions of accounts onto rival apps.";
  const heroLead2 =
    lang === "hi"
      ? "यह लेख उन पाठकों के लिए डॉक्युमेंट्री-शैली में लिखी गई जाँच है जिन्हें बहुत ऊँचे स्तर की प्राइवेसी चाहिए। हर तथ्य के साथ नीचे दिए स्रोत का नंबर है — एक क्लिक में आप WhatsApp की अपनी पॉलिसी, अदालत के फ़ैसलों, रेगुलेटरी आदेशों, peer-reviewed शोध और Amnesty International, The Citizen Lab, Mozilla, The Washington Post, TechCrunch, Reuters, NBC News, और Irish Data Protection Commission जैसी रिपोर्टों तक पहुँच जाएँगे। एक भी वाक्य आप ख़ुद verify कर सकते हैं।"
      : "This article is a documentary-style investigation, written for readers who want very high privacy. Every claim below is followed by a numbered citation that links to the bibliography at the bottom — a mix of WhatsApp's own policy pages, court documents, regulatory rulings, peer-reviewed research, and reporting from outlets including Amnesty International, The Citizen Lab, Mozilla, The Washington Post, TechCrunch, Reuters, NBC News and the Irish Data Protection Commission. You can verify any sentence in this piece in one click.";
  const tocLabel = lang === "hi" ? "इस रिपोर्ट में क्या-क्या है" : "What's in this report";
  const sourcesHeading = lang === "hi" ? "स्रोत और सन्दर्भ" : "Sources & references";
  const sourcesIntro =
    lang === "hi"
      ? `ऊपर का हर दावा नीचे दिए ${SOURCES.length} स्रोतों में से किसी एक से जुड़ा है। हमने जान-बूझकर अलग-अलग प्रकार के स्रोत मिलाए — WhatsApp के अपने पॉलिसी पेज, अदालत के फ़ैसले, रेगुलेटरी निर्णय, स्वतंत्र फ़ोरेंसिक रिसर्चर, peer-reviewed academic काम, और राजनीतिक स्पेक्ट्रम के अलग-अलग सिरों के मीडिया — ताकि किसी एक स्रोत पर भरोसा करना ज़रूरी न पड़े।`
      : `Every claim above is keyed to one of the ${SOURCES.length} numbered sources below. We deliberately mixed source types — WhatsApp's own policy pages, court rulings, regulatory decisions, independent forensic researchers, peer-reviewed academic work, and reporting from outlets across the political spectrum — so that no single source has to be trusted on its own.`;
  const ctaTry = lang === "hi" ? "VeilChat आज़माएँ — मुफ़्त, 30 सेकंड में" : "Try VeilChat — free, 30 seconds";
  const ctaBack = lang === "hi" ? "← होम पर वापस" : "← Back to home";
  const corrections =
    lang === "hi"
      ? "यह लेख सार्वजनिक स्रोतों से बनाया गया है और टिप्पणी / पत्रकारिता के रूप में है, क़ानूनी सलाह नहीं। अगर कोई तथ्य ग़लत या पुराना दिखे, तो हमें बताइए — हम तारीख़ के साथ correction प्रकाशित करेंगे।"
      : "This article was assembled from public sources and is intended as commentary and journalism, not legal advice. If you spot a factual error or an out-of-date citation, please let us know — we will publish a correction with a dated changelog.";
  const correctionsTitle = lang === "hi" ? "Methodology और corrections" : "Methodology and corrections";

  return (
    <div
      className="min-h-screen antialiased"
      style={{
        backgroundColor: "#FCF5EB",
        color: "#111B21",
        fontFamily:
          "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Reading progress bar */}
      <div
        aria-hidden
        className="fixed top-0 left-0 right-0 h-[3px] z-50"
        style={{ backgroundColor: "transparent" }}
      >
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            backgroundColor: "#2E6F40",
            transition: "width 80ms linear",
          }}
        />
      </div>

      {/* Top bar */}
      <header className="max-w-[1200px] mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 group">
          <span
            aria-hidden
            className="grid place-items-center w-8 h-8 rounded-lg text-white font-bold"
            style={{ backgroundColor: "#2E6F40" }}
          >
            ✓
          </span>
          <span className="font-semibold text-[#0F2A18] group-hover:opacity-80">
            VeilChat
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <div
            role="tablist"
            aria-label={lang === "hi" ? "भाषा चुनें" : "Choose language"}
            className="inline-flex items-center rounded-full border border-[#0F2A18]/15 bg-white/70 p-1 text-sm font-medium"
          >
            <button
              role="tab"
              aria-selected={lang === "en"}
              onClick={() => setLang("en")}
              className={[
                "px-3 py-1.5 rounded-full transition-colors",
                lang === "en"
                  ? "bg-[#2E6F40] text-white"
                  : "text-[#0F2A18] hover:bg-[#0F2A18]/5",
              ].join(" ")}
            >
              English
            </button>
            <button
              role="tab"
              aria-selected={lang === "hi"}
              onClick={() => setLang("hi")}
              className={[
                "px-3 py-1.5 rounded-full transition-colors",
                lang === "hi"
                  ? "bg-[#2E6F40] text-white"
                  : "text-[#0F2A18] hover:bg-[#0F2A18]/5",
              ].join(" ")}
            >
              हिन्दी
            </button>
          </div>
          <Link
            to="/welcome"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium hover:opacity-90"
            style={{ backgroundColor: "#2E6F40" }}
          >
            {lang === "hi" ? "VeilChat आज़माएँ" : "Try VeilChat"}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-[820px] mx-auto px-5 sm:px-8 pt-6 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8F3E5] text-[#2E6F40] text-xs font-medium tracking-wide uppercase">
          <span aria-hidden>🔎</span> {heroBadge}
        </div>
        <h1 className="mt-5 text-[40px] sm:text-[56px] leading-[1.05] font-semibold tracking-tight text-[#0F2A18]">
          {heroTitle}
        </h1>
        <p className="mt-6 text-[18.5px] leading-[1.7] text-[#28332c]">{heroLead1}</p>
        <p className="mt-4 text-[18.5px] leading-[1.7] text-[#28332c]">{heroLead2}</p>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[#4a5a4f]">
          <span>
            {lang === "hi" ? "पढ़ने का समय" : "Reading time"} · ~{readingMinutes} min
          </span>
          <span aria-hidden>·</span>
          <span>
            {SOURCES.length} {lang === "hi" ? "मुख्य स्रोत" : "primary sources"}
          </span>
          <span aria-hidden>·</span>
          <span>
            {lang === "hi" ? "अद्यतन" : "Updated"} {new Date().getFullYear()}
          </span>
        </div>
      </section>

      {/* TOC */}
      <nav
        aria-label={lang === "hi" ? "सामग्री सूची" : "Table of contents"}
        className="max-w-[820px] mx-auto px-5 sm:px-8 mt-12"
      >
        <div className="rounded-2xl border border-[#e2dfd6] bg-white/60 backdrop-blur p-5 sm:p-6">
          <div className="text-xs uppercase tracking-wider text-[#5b6c61] font-medium mb-3">
            {tocLabel}
          </div>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-2 list-none">
            {tocItems.map((t) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  className="text-[15.5px] text-[#1f2a24] hover:text-[#2E6F40] hover:underline"
                >
                  {t.label}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      {/* Article */}
      <article className="max-w-[820px] mx-auto px-5 sm:px-8 pb-24">
        {lang === "hi" ? <ArticleHindi /> : <ArticleEnglish />}

        {/* SOURCES (shared) */}
        <H2 id="sources">{sourcesHeading}</H2>
        <P>{sourcesIntro}</P>
        <ol className="space-y-3 list-none mt-6">
          {SOURCES.map((s) => (
            <li
              id={`src-${s.n}`}
              key={s.n}
              className="rounded-lg px-4 py-3 transition-shadow"
              style={{ backgroundColor: "rgba(255,255,255,0.55)" }}
            >
              <div className="flex gap-3">
                <span className="font-semibold text-[#2E6F40] tabular-nums w-7 shrink-0">
                  [{s.n}]
                </span>
                <div className="text-[15.5px] leading-[1.65]">
                  <span className="font-medium text-[#0F2A18]">{s.title}</span>
                  <span className="text-[#4a5a4f]"> · {s.publisher}</span>
                  {s.date ? <span className="text-[#4a5a4f]"> · {s.date}</span> : null}
                  <div className="break-all">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2E6F40] hover:underline"
                    >
                      {s.url}
                    </a>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <Callout tone="info" title={correctionsTitle}>
          {corrections}
        </Callout>

        <div className="mt-14 flex flex-wrap items-center gap-3">
          <Link
            to="/welcome"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-white font-medium hover:opacity-90"
            style={{ backgroundColor: "#2E6F40" }}
          >
            {ctaTry}
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full font-medium text-[#0F2A18] hover:bg-[#0F2A18]/5 border border-[#0F2A18]/15"
          >
            {ctaBack}
          </Link>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-[#e2dfd6] bg-white/40">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8 text-sm text-[#4a5a4f] flex flex-wrap items-center justify-between gap-3">
          <div>
            © {new Date().getFullYear()} VeilChat.{" "}
            {lang === "hi" ? "Privacy by design।" : "Private by design."}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Link to="/promises" className="hover:text-[#0F2A18]">
              {lang === "hi" ? "वादे" : "Promises"}
            </Link>
            <Link to="/what-we-store" className="hover:text-[#0F2A18]">
              {lang === "hi" ? "हम क्या स्टोर करते हैं" : "What we store"}
            </Link>
            <Link to="/encryption" className="hover:text-[#0F2A18]">
              {lang === "hi" ? "एन्क्रिप्शन" : "Encryption"}
            </Link>
            <Link to="/" className="hover:text-[#0F2A18]">
              {lang === "hi" ? "होम" : "Home"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

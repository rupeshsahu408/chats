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
  { n: 98, title: "Report of the Independent International Fact-Finding Mission on Myanmar", publisher: "United Nations Human Rights Council", url: "https://www.ohchr.org/en/hr-bodies/hrc/myanmar-ffm/report", date: "Sep 2018" },
  { n: 99, title: "A genocide incited on Facebook, with posts in Myanmar", publisher: "The New York Times", url: "https://www.nytimes.com/2018/10/15/technology/myanmar-facebook-genocide.html", date: "Oct 15, 2018" },
  { n: 100, title: "Facebook admits it was used to 'incite offline violence' in Myanmar", publisher: "BBC News", url: "https://www.bbc.com/news/world-asia-pacific-46105934", date: "Nov 6, 2018" },
  { n: 101, title: "Rohingya refugees sue Meta for $150bn over Facebook hate speech", publisher: "The Guardian", url: "https://www.theguardian.com/technology/2021/dec/06/rohingya-refugees-sue-facebook-150bn-myanmar-genocide", date: "Dec 6, 2021" },
  { n: 102, title: "WhatsApp used to spread fake news in Brazil elections — and helped Bolsonaro win", publisher: "The Guardian", url: "https://www.theguardian.com/world/2018/oct/25/brazil-president-jair-bolsonaro-whatsapp-fake-news", date: "Oct 25, 2018" },
  { n: 103, title: "Disinformation on WhatsApp in Brazil's 2018 Presidential Campaign", publisher: "Reuters Institute / University of Oxford", url: "https://reutersinstitute.politics.ox.ac.uk/", date: "2018" },
  { n: 104, title: "WhatsApp groups and the 2018 Brazilian election", publisher: "MIT Technology Review", url: "https://www.technologyreview.com/2019/10/30/65453/whatsapp-groups-and-the-2018-brazilian-election/", date: "Oct 30, 2019" },
  { n: 105, title: "CVE-2019-3568 Detail — Buffer Overflow in WhatsApp VOIP Stack", publisher: "NIST National Vulnerability Database", url: "https://nvd.nist.gov/vuln/detail/CVE-2019-3568", date: "May 2019" },
  { n: 106, title: "CVE-2022-36934 — WhatsApp Integer Overflow Leading to Remote Code Execution", publisher: "NIST National Vulnerability Database", url: "https://nvd.nist.gov/vuln/detail/CVE-2022-36934", date: "Sep 2022" },
  { n: 107, title: "CVE-2022-27492 — WhatsApp Integer Underflow in Video File Parsing", publisher: "NIST National Vulnerability Database", url: "https://nvd.nist.gov/vuln/detail/CVE-2022-27492", date: "Sep 2022" },
  { n: 108, title: "CVE-2021-24027 — WhatsApp Cache Configuration Bypass", publisher: "NIST National Vulnerability Database", url: "https://nvd.nist.gov/vuln/detail/CVE-2021-24027", date: "Apr 2021" },
  { n: 109, title: "WhatsApp Desktop app vulnerable to Python, PHP code execution", publisher: "Check Point Research", url: "https://research.checkpoint.com/2020/whatsapp-desktop-app-vulnerable-to-python-php-code-execution/", date: "Feb 2020" },
  { n: 110, title: "Multiple vulnerabilities in WhatsApp for Desktop", publisher: "Check Point Research", url: "https://research.checkpoint.com/2019/breakingapp-whatsapp-exploit-decryption/", date: "2019" },
  { n: 111, title: "COVID-19 infodemic — managing the infodemic", publisher: "World Health Organization", url: "https://www.who.int/docs/default-source/coronaviruse/situation-reports/20200202-sitrep-13-ncov-v3.pdf", date: "Feb 2020" },
  { n: 112, title: "WhatsApp limits message forwarding to combat coronavirus misinformation globally", publisher: "Reuters", url: "https://www.reuters.com/article/us-health-coronavirus-whatsapp/whatsapp-limits-message-forwarding-to-combat-coronavirus-misinformation-globally-idUSKBN21P2O3", date: "Apr 7, 2020" },
  { n: 113, title: "Fake coronavirus cures, 5G conspiracies spread on WhatsApp", publisher: "BBC News", url: "https://www.bbc.com/news/technology-52440896", date: "May 2020" },
  { n: 114, title: "Frances Haugen testimony to the US Senate", publisher: "U.S. Senate Committee on Commerce, Science, and Transportation", url: "https://www.commerce.senate.gov/2021/10/protecting-kids-online-facebook-instagram-and-mental-health", date: "Oct 5, 2021" },
  { n: 115, title: "The Facebook Files — What Facebook Knows", publisher: "The Wall Street Journal", url: "https://www.wsj.com/articles/the-facebook-files-11631713039", date: "Sep 2021" },
  { n: 116, title: "Facebook Paid $5 Billion to FTC; Facebook Paid $100 Million to SEC; DOJ Filed Suit Against Facebook", publisher: "Federal Trade Commission", url: "https://www.ftc.gov/news-events/news/press-releases/2019/07/ftc-imposes-5-billion-penalty-sweeping-new-privacy-restrictions-facebook", date: "Jul 24, 2019" },
  { n: 117, title: "WhatsApp: A comparison of privacy risks to Signal", publisher: "EFF Surveillance Self-Defense", url: "https://ssd.eff.org/module/choosing-your-tools", date: "2024" },
  { n: 118, title: "Which apps and tools actually keep us safer online?", publisher: "Electronic Frontier Foundation", url: "https://www.eff.org/pages/secure-messaging-scorecard", date: "current" },
  { n: 119, title: "Signal >> WhatsApp — The Technical Differences", publisher: "Security in a Box / Frontline Defenders", url: "https://securityinabox.org/en/communication/signal/", date: "current" },
  { n: 120, title: "About disappearing messages on WhatsApp", publisher: "WhatsApp Help Center", url: "https://faq.whatsapp.com/1686862961706247", date: "current" },
  { n: 121, title: "WhatsApp's disappearing messages: what it does and doesn't do for privacy", publisher: "Ars Technica", url: "https://arstechnica.com/information-technology/2021/01/disappearing-messages-whatsapps-new-feature/", date: "Jan 2021" },
  { n: 122, title: "India IT Rules 2021 — Intermediary Guidelines and Digital Media Ethics Code", publisher: "Ministry of Electronics and Information Technology, India", url: "https://www.meity.gov.in/content/notification-dated-25th-february-2021-intermediary-guidelines-and-digital-media-ethics", date: "Feb 25, 2021" },
  { n: 123, title: "WhatsApp LLC vs. Union of India — WhatsApp challenges traceability rules", publisher: "High Court of Delhi", url: "https://indiankanoon.org/search/?formInput=whatsapp+traceability+high+court+delhi", date: "2021" },
  { n: 124, title: "WhatsApp is fighting the Indian government over a rule that could end encryption as we know it", publisher: "MIT Technology Review", url: "https://www.technologyreview.com/2021/05/26/1025358/whatsapp-india-encryption-privacy/", date: "May 26, 2021" },
  { n: 125, title: "Age verification on WhatsApp: who checks?", publisher: "Internet Matters / 5Rights Foundation", url: "https://www.5rightsfoundation.com/", date: "2023" },
  { n: 126, title: "GDPR Article 8 — Conditions applicable to child's consent", publisher: "EUR-Lex / European Parliament", url: "https://gdpr-info.eu/art-8-gdpr/", date: "2018" },
  { n: 127, title: "WhatsApp and its handling of children's data — ICO regulatory action", publisher: "UK Information Commissioner's Office", url: "https://ico.org.uk/media/action-weve-taken/2618383/whatsapp-reprimand-20210831.pdf", date: "Aug 2021" },
  { n: 128, title: "EU Digital Markets Act — Designation of WhatsApp as gatekeeper", publisher: "European Commission", url: "https://digital-markets-act.ec.europa.eu/gatekeepers_en", date: "Sep 6, 2023" },
  { n: 129, title: "DMA: Commission opens non-compliance proceedings against Apple and Meta", publisher: "European Commission", url: "https://ec.europa.eu/commission/presscorner/detail/en/ip_24_1689", date: "Mar 25, 2024" },
  { n: 130, title: "Metadata: The most damaging intelligence", publisher: "Bruce Schneier / Schneier on Security", url: "https://www.schneier.com/blog/archives/2014/05/metadata_as_a_m.html", date: "May 2014" },
  { n: 131, title: "An FBI surveillance guide on Signal, iMessage, WhatsApp and more", publisher: "Forbes", url: "https://www.forbes.com/sites/thomasbrewster/2021/11/23/the-fbi-says-these-are-the-most-secure-messaging-apps/", date: "Nov 2021" },
  { n: 132, title: "ProPublica: How WhatsApp Moderates Private Messages Despite End-to-End Encryption", publisher: "ProPublica", url: "https://www.propublica.org/article/how-whatsapp-moderates-private-messages-despite-end-to-end-encryption", date: "Sep 7, 2021" },
  { n: 133, title: "WhatsApp: 100 billion messages sent each day", publisher: "BBC News", url: "https://www.bbc.com/news/technology-55826636", date: "Jan 26, 2021" },
  { n: 134, title: "Understanding Metadata and the Privacy Implications", publisher: "ACLU", url: "https://www.aclu.org/news/national-security/the-governments-own-expert-says-metadata-surveillance-is-more-invasive-than-you-think", date: "2014" },
  { n: 135, title: "WhatsApp and child safety: concerns and enforcement record", publisher: "National Society for the Prevention of Cruelty to Children (NSPCC)", url: "https://www.nspcc.org.uk/about-us/news-opinion/2023/whatsapp-child-safety/", date: "2023" },
  { n: 136, title: "WhatsApp Security Advisory — November 2021 (multiple CVEs)", publisher: "WhatsApp Security Advisories", url: "https://www.whatsapp.com/security/advisories/2021/", date: "2021" },
  { n: 137, title: "Encryption Debate: UK Online Safety Act and WhatsApp", publisher: "BBC News", url: "https://www.bbc.com/news/technology-66396156", date: "Sep 2023" },
  { n: 138, title: "WhatsApp threatened to leave UK over Online Safety Act encryption provisions", publisher: "The Guardian", url: "https://www.theguardian.com/technology/2023/mar/07/whatsapp-would-rather-be-blocked-in-the-uk-than-weaken-its-privacy-for-users", date: "Mar 7, 2023" },
  { n: 139, title: "UK Online Safety Act receives royal assent", publisher: "UK Parliament", url: "https://www.gov.uk/government/collections/online-safety-act", date: "Oct 2023" },
  { n: 140, title: "WhatsApp Pay: privacy and financial data risks", publisher: "Privacy International", url: "https://privacyinternational.org/", date: "2021" },
  { n: 141, title: "WhatsApp Payments India: data sharing with Meta", publisher: "Medianama", url: "https://www.medianama.com/2020/02/223-whatsapp-pay-privacy/", date: "Feb 2020" },
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
  { id: "risk-calc", label: "Your personal WhatsApp risk score" },
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
  { id: "myanmar", label: "22. WhatsApp & the Rohingya genocide" },
  { id: "brazil2018", label: "23. Brazil 2018: WhatsApp as a disinformation machine" },
  { id: "whatsapppay", label: "24. WhatsApp Pay — your financial data" },
  { id: "cves", label: "25. A catalogue of critical security vulnerabilities" },
  { id: "webdesktop", label: "26. WhatsApp Web & Desktop: expanded attack surface" },
  { id: "groups", label: "27. WhatsApp Groups: mass privacy implications" },
  { id: "covid", label: "28. COVID-19: WhatsApp as a misinformation accelerator" },
  { id: "haugen", label: "29. Frances Haugen & the internal Meta documents" },
  { id: "children", label: "30. Children on WhatsApp: age verification failures" },
  { id: "dma", label: "31. The EU Digital Markets Act & WhatsApp's obligations" },
  { id: "india_it_rules", label: "32. India's IT Rules 2021 vs. WhatsApp — the traceability demand" },
  { id: "signal_vs", label: "33. Signal vs. WhatsApp: what you actually trade away" },
  { id: "disappearing", label: "34. Disappearing messages — what actually gets deleted" },
  { id: "experts", label: "35. What experts, courts & whistleblowers recommend" },
  { id: "sources", label: "Sources & references" },
];

const TOC_HI: { id: string; label: string }[] = [
  { id: "risk-calc", label: "आपका व्यक्तिगत WhatsApp जोखिम स्कोर" },
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
  { id: "myanmar", label: "22. WhatsApp और रोहिंग्या नरसंहार" },
  { id: "brazil2018", label: "23. ब्राज़ील 2018 — WhatsApp एक 'दुष्प्रचार मशीन' के रूप में" },
  { id: "whatsapppay", label: "24. WhatsApp Pay — आपका वित्तीय डेटा" },
  { id: "cves", label: "25. गंभीर सुरक्षा कमज़ोरियों की सूची (CVE)" },
  { id: "webdesktop", label: "26. WhatsApp Web और Desktop — बड़ा हमले का क्षेत्र" },
  { id: "groups", label: "27. WhatsApp ग्रुप — सामूहिक प्राइवेसी के खतरे" },
  { id: "covid", label: "28. COVID-19 — WhatsApp एक गलत सूचना का त्वरक" },
  { id: "haugen", label: "29. Frances Haugen और Meta के आंतरिक दस्तावेज़" },
  { id: "children", label: "30. WhatsApp पर बच्चे — आयु सत्यापन में विफलता" },
  { id: "dma", label: "31. EU डिजिटल मार्केट्स एक्ट और WhatsApp की ज़िम्मेदारी" },
  { id: "india_it_rules", label: "32. भारत के IT नियम 2021 बनाम WhatsApp — ट्रेसेबिलिटी की माँग" },
  { id: "signal_vs", label: "33. Signal vs WhatsApp — आप असल में क्या खो देते हैं" },
  { id: "disappearing", label: "34. गायब होने वाले मैसेज — असल में क्या डिलीट होता है" },
  { id: "experts", label: "35. विशेषज्ञ, अदालतें और व्हिसलब्लोअर क्या सलाह देते हैं" },
  { id: "sources", label: "स्रोत और सन्दर्भ" },
];

const TOC_PT: { id: string; label: string }[] = [
  { id: "risk-calc", label: "Sua pontuação de risco pessoal no WhatsApp" },
  { id: "tldr", label: "Em resumo — o que este artigo prova" },
  { id: "owners", label: "1. Quem realmente é dono do WhatsApp" },
  { id: "founders", label: "2. Os próprios fundadores saíram em protesto" },
  { id: "policy", label: "3. O que a Política de Privacidade realmente diz" },
  { id: "metadata", label: "4. Metadados — o que a criptografia não esconde" },
  { id: "y2021", label: "5. A atualização forçada de 2021" },
  { id: "backups", label: "6. A brecha dos backups em nuvem" },
  { id: "business", label: "7. WhatsApp Business — onde o E2EE acaba silenciosamente" },
  { id: "ads", label: "8. Anúncios dentro do WhatsApp (junho 2025)" },
  { id: "ai", label: "9. Meta AI na sua lista de conversas" },
  { id: "law", label: "10. Governos e autoridades policiais" },
  { id: "pegasus", label: "11. Pegasus — veredicto de US$167M do NSO" },
  { id: "victims", label: "12. Vítimas do Pegasus por país" },
  { id: "paragon", label: "13. Paragon Graphite (2025)" },
  { id: "leaks", label: "14. Vazamentos, bugs e recursos quebrados" },
  { id: "leak2022", label: "15. O vazamento de 487 milhões de números (2022)" },
  { id: "fines", label: "16. Multas regulatórias e proibições" },
  { id: "bans", label: "17. Bloqueios em nível nacional" },
  { id: "lynch", label: "18. WhatsApp, desinformação e linchamentos" },
  { id: "delete", label: "19. O que 'excluir conta' realmente exclui" },
  { id: "scams", label: "20. Golpes em escala industrial" },
  { id: "verdict", label: "21. O veredicto para usuários de alta privacidade" },
  { id: "myanmar", label: "22. WhatsApp e o genocídio Rohingya" },
  { id: "brazil2018", label: "23. Brasil 2018 — WhatsApp como máquina de desinformação" },
  { id: "whatsapppay", label: "24. WhatsApp Pay — seus dados financeiros" },
  { id: "cves", label: "25. Vulnerabilidades críticas de segurança (CVEs)" },
  { id: "webdesktop", label: "26. WhatsApp Web e Desktop — superfície de ataque expandida" },
  { id: "groups", label: "27. Grupos do WhatsApp — riscos coletivos de privacidade" },
  { id: "covid", label: "28. COVID-19 — WhatsApp como amplificador de desinformação" },
  { id: "haugen", label: "29. Frances Haugen e os documentos internos da Meta" },
  { id: "children", label: "30. Crianças no WhatsApp — falha na verificação de idade" },
  { id: "dma", label: "31. Lei dos Mercados Digitais da UE e o WhatsApp" },
  { id: "india_it_rules", label: "32. Regras de TI da Índia 2021 vs. WhatsApp" },
  { id: "signal_vs", label: "33. Signal vs. WhatsApp — o que você realmente perde" },
  { id: "disappearing", label: "34. Mensagens temporárias — o que realmente é excluído" },
  { id: "experts", label: "35. O que especialistas, tribunais e whistleblowers recomendam" },
  { id: "sources", label: "Fontes e referências" },
];

const TOC_ID: { id: string; label: string }[] = [
  { id: "risk-calc", label: "Skor risiko privasi WhatsApp Anda" },
  { id: "tldr", label: "Ringkasan — apa yang dibuktikan artikel ini" },
  { id: "owners", label: "1. Siapa yang benar-benar memiliki WhatsApp" },
  { id: "founders", label: "2. Para pendiri sendiri keluar karena privasi" },
  { id: "policy", label: "3. Apa yang sebenarnya dikatakan Kebijakan Privasi" },
  { id: "metadata", label: "4. Metadata — yang tidak disembunyikan enkripsi" },
  { id: "y2021", label: "5. Pembaruan paksa 2021" },
  { id: "backups", label: "6. Celah backup cloud" },
  { id: "business", label: "7. WhatsApp Business — di mana E2EE berakhir diam-diam" },
  { id: "ads", label: "8. Iklan di dalam WhatsApp (Juni 2025)" },
  { id: "ai", label: "9. Meta AI di daftar obrolan Anda" },
  { id: "law", label: "10. Pemerintah dan penegak hukum" },
  { id: "pegasus", label: "11. Pegasus — vonis NSO US$167 juta" },
  { id: "victims", label: "12. Korban Pegasus per negara" },
  { id: "paragon", label: "13. Paragon Graphite (2025)" },
  { id: "leaks", label: "14. Kebocoran, bug, dan fitur rusak" },
  { id: "leak2022", label: "15. Kebocoran 487 juta nomor (2022)" },
  { id: "fines", label: "16. Denda regulasi dan larangan" },
  { id: "bans", label: "17. Pemblokiran di tingkat negara" },
  { id: "lynch", label: "18. WhatsApp, hoaks, dan pembunuhan massal" },
  { id: "delete", label: "19. Apa yang benar-benar dihapus saat 'hapus akun'" },
  { id: "scams", label: "20. Penipuan skala industri" },
  { id: "verdict", label: "21. Kesimpulan untuk pengguna yang peduli privasi" },
  { id: "myanmar", label: "22. WhatsApp dan genosida Rohingya" },
  { id: "brazil2018", label: "23. Brasil 2018 — WhatsApp sebagai mesin disinformasi" },
  { id: "whatsapppay", label: "24. WhatsApp Pay — data keuangan Anda" },
  { id: "cves", label: "25. Kerentanan keamanan kritis (CVE)" },
  { id: "webdesktop", label: "26. WhatsApp Web dan Desktop — permukaan serangan lebih luas" },
  { id: "groups", label: "27. Grup WhatsApp — risiko privasi kolektif" },
  { id: "covid", label: "28. COVID-19 — WhatsApp sebagai amplifier disinformasi" },
  { id: "haugen", label: "29. Frances Haugen dan dokumen internal Meta" },
  { id: "children", label: "30. Anak-anak di WhatsApp — kegagalan verifikasi usia" },
  { id: "dma", label: "31. Undang-Undang Pasar Digital UE dan WhatsApp" },
  { id: "india_it_rules", label: "32. Aturan IT India 2021 vs. WhatsApp" },
  { id: "signal_vs", label: "33. Signal vs. WhatsApp — apa yang benar-benar Anda korbankan" },
  { id: "disappearing", label: "34. Pesan menghilang — apa yang benar-benar terhapus" },
  { id: "experts", label: "35. Apa yang disarankan ahli, pengadilan, dan whistleblower" },
  { id: "sources", label: "Sumber dan referensi" },
];

const TOC_ES: { id: string; label: string }[] = [
  { id: "risk-calc", label: "Tu puntuación de riesgo personal en WhatsApp" },
  { id: "tldr", label: "En resumen — lo que prueba este artículo" },
  { id: "owners", label: "1. Quién es el verdadero dueño de WhatsApp" },
  { id: "founders", label: "2. Los propios fundadores se fueron por privacidad" },
  { id: "policy", label: "3. Lo que realmente dice la Política de Privacidad" },
  { id: "metadata", label: "4. Metadatos — lo que el cifrado no oculta" },
  { id: "y2021", label: "5. La actualización forzada de 2021" },
  { id: "backups", label: "6. La brecha de las copias de seguridad en la nube" },
  { id: "business", label: "7. WhatsApp Business — donde el E2EE termina silenciosamente" },
  { id: "ads", label: "8. Anuncios dentro de WhatsApp (junio 2025)" },
  { id: "ai", label: "9. Meta AI en tu lista de chats" },
  { id: "law", label: "10. Gobiernos y fuerzas del orden" },
  { id: "pegasus", label: "11. Pegasus — veredicto de US$167M contra NSO" },
  { id: "victims", label: "12. Víctimas de Pegasus por país" },
  { id: "paragon", label: "13. Paragon Graphite (2025)" },
  { id: "leaks", label: "14. Filtraciones, errores y funciones rotas" },
  { id: "leak2022", label: "15. La filtración de 487 millones de números (2022)" },
  { id: "fines", label: "16. Multas regulatorias y sanciones" },
  { id: "bans", label: "17. Bloqueos a nivel nacional" },
  { id: "lynch", label: "18. WhatsApp, bulos y linchamientos" },
  { id: "delete", label: "19. Lo que 'eliminar cuenta' realmente elimina" },
  { id: "scams", label: "20. Estafas a escala industrial" },
  { id: "verdict", label: "21. El veredicto para usuarios de alta privacidad" },
  { id: "myanmar", label: "22. WhatsApp y el genocidio Rohingya" },
  { id: "brazil2018", label: "23. Brasil 2018 — WhatsApp como máquina de desinformación" },
  { id: "whatsapppay", label: "24. WhatsApp Pay — tus datos financieros" },
  { id: "cves", label: "25. Vulnerabilidades de seguridad críticas (CVE)" },
  { id: "webdesktop", label: "26. WhatsApp Web y Escritorio — mayor superficie de ataque" },
  { id: "groups", label: "27. Grupos de WhatsApp — riesgos colectivos de privacidad" },
  { id: "covid", label: "28. COVID-19 — WhatsApp como amplificador de desinformación" },
  { id: "haugen", label: "29. Frances Haugen y los documentos internos de Meta" },
  { id: "children", label: "30. Menores en WhatsApp — fallo en la verificación de edad" },
  { id: "dma", label: "31. Ley de Mercados Digitales de la UE y WhatsApp" },
  { id: "india_it_rules", label: "32. Normas IT de India 2021 vs. WhatsApp" },
  { id: "signal_vs", label: "33. Signal vs. WhatsApp — lo que realmente pierdes" },
  { id: "disappearing", label: "34. Mensajes temporales — lo que realmente se elimina" },
  { id: "experts", label: "35. Lo que recomiendan expertos, tribunales y denunciantes" },
  { id: "sources", label: "Fuentes y referencias" },
];

const TOC_RU: { id: string; label: string }[] = [
  { id: "risk-calc", label: "Ваш личный рейтинг риска в WhatsApp" },
  { id: "tldr", label: "Коротко — что доказывает эта статья" },
  { id: "owners", label: "1. Кто на самом деле владеет WhatsApp" },
  { id: "founders", label: "2. Сами основатели ушли из-за конфиденциальности" },
  { id: "policy", label: "3. Что на самом деле говорит Политика конфиденциальности" },
  { id: "metadata", label: "4. Метаданные — что не скрывает шифрование" },
  { id: "y2021", label: "5. Принудительное обновление 2021 года" },
  { id: "backups", label: "6. Уязвимость облачного резервного копирования" },
  { id: "business", label: "7. WhatsApp Business — где E2EE незаметно заканчивается" },
  { id: "ads", label: "8. Реклама внутри WhatsApp (июнь 2025)" },
  { id: "ai", label: "9. Meta AI в вашем списке чатов" },
  { id: "law", label: "10. Правительства и правоохранительные органы" },
  { id: "pegasus", label: "11. Pegasus — приговор NSO на $167 млн" },
  { id: "victims", label: "12. Жертвы Pegasus по странам" },
  { id: "paragon", label: "13. Paragon Graphite (2025)" },
  { id: "leaks", label: "14. Утечки, уязвимости и сломанные функции" },
  { id: "leak2022", label: "15. Утечка 487 млн номеров (2022)" },
  { id: "fines", label: "16. Регуляторные штрафы и запреты" },
  { id: "bans", label: "17. Национальные блокировки" },
  { id: "lynch", label: "18. WhatsApp, фейки и линчевания" },
  { id: "delete", label: "19. Что «удалить аккаунт» на самом деле удаляет" },
  { id: "scams", label: "20. Мошенничество промышленного масштаба" },
  { id: "verdict", label: "21. Вывод для пользователей, заботящихся о конфиденциальности" },
  { id: "myanmar", label: "22. WhatsApp и геноцид рохинджа" },
  { id: "brazil2018", label: "23. Бразилия 2018 — WhatsApp как машина дезинформации" },
  { id: "whatsapppay", label: "24. WhatsApp Pay — ваши финансовые данные" },
  { id: "cves", label: "25. Критические уязвимости безопасности (CVE)" },
  { id: "webdesktop", label: "26. WhatsApp Web и Desktop — расширенная поверхность атаки" },
  { id: "groups", label: "27. Группы WhatsApp — коллективные риски конфиденциальности" },
  { id: "covid", label: "28. COVID-19 — WhatsApp как усилитель дезинформации" },
  { id: "haugen", label: "29. Фрэнсис Хауген и внутренние документы Meta" },
  { id: "children", label: "30. Дети в WhatsApp — провал проверки возраста" },
  { id: "dma", label: "31. Закон ЕС о цифровых рынках и WhatsApp" },
  { id: "india_it_rules", label: "32. Правила IT Индии 2021 против WhatsApp" },
  { id: "signal_vs", label: "33. Signal против WhatsApp — что вы реально теряете" },
  { id: "disappearing", label: "34. Исчезающие сообщения — что на самом деле удаляется" },
  { id: "experts", label: "35. Что рекомендуют эксперты, суды и разоблачители" },
  { id: "sources", label: "Источники и ссылки" },
];

const TOC_DE: { id: string; label: string }[] = [
  { id: "risk-calc", label: "Ihr persönlicher WhatsApp-Risiko-Score" },
  { id: "tldr", label: "Kurz zusammengefasst — was dieser Artikel beweist" },
  { id: "owners", label: "1. Wem WhatsApp wirklich gehört" },
  { id: "founders", label: "2. Die eigenen Gründer verließen das Unternehmen" },
  { id: "policy", label: "3. Was die Datenschutzrichtlinie wirklich sagt" },
  { id: "metadata", label: "4. Metadaten — was die Verschlüsselung nicht verbirgt" },
  { id: "y2021", label: "5. Das erzwungene Update von 2021" },
  { id: "backups", label: "6. Die Cloud-Backup-Lücke" },
  { id: "business", label: "7. WhatsApp Business — wo E2EE still endet" },
  { id: "ads", label: "8. Werbung innerhalb von WhatsApp (Juni 2025)" },
  { id: "ai", label: "9. Meta AI in Ihrer Chat-Liste" },
  { id: "law", label: "10. Regierungen und Strafverfolgung" },
  { id: "pegasus", label: "11. Pegasus — das NSO-Urteil über 167 Mio. USD" },
  { id: "victims", label: "12. Pegasus-Opfer nach Land" },
  { id: "paragon", label: "13. Paragon Graphite (2025)" },
  { id: "leaks", label: "14. Datenlecks, Bugs und kaputte Funktionen" },
  { id: "leak2022", label: "15. Das Datenleck von 487 Mio. Nummern (2022)" },
  { id: "fines", label: "16. Bußgelder und behördliche Maßnahmen" },
  { id: "bans", label: "17. Verbote auf nationaler Ebene" },
  { id: "lynch", label: "18. WhatsApp, Falschnachrichten und Lynchjustiz" },
  { id: "delete", label: '19. Was \u201EKonto l\u00F6schen\u201C wirklich l\u00F6scht' },
  { id: "scams", label: "20. Betrug im industriellen Maßstab" },
  { id: "verdict", label: "21. Das Fazit für Nutzer mit hohem Datenschutzbedarf" },
  { id: "myanmar", label: "22. WhatsApp und der Rohingya-Genozid" },
  { id: "brazil2018", label: "23. Brasilien 2018 — WhatsApp als Desinformationsmaschine" },
  { id: "whatsapppay", label: "24. WhatsApp Pay — Ihre Finanzdaten" },
  { id: "cves", label: "25. Kritische Sicherheitslücken (CVEs)" },
  { id: "webdesktop", label: "26. WhatsApp Web und Desktop — größere Angriffsfläche" },
  { id: "groups", label: "27. WhatsApp-Gruppen — kollektive Datenschutzrisiken" },
  { id: "covid", label: "28. COVID-19 — WhatsApp als Desinformations-Verstärker" },
  { id: "haugen", label: "29. Frances Haugen und Metas interne Dokumente" },
  { id: "children", label: "30. Kinder bei WhatsApp — versagte Altersverifizierung" },
  { id: "dma", label: "31. EU Digital Markets Act und WhatsApp" },
  { id: "india_it_rules", label: "32. Indiens IT-Regeln 2021 vs. WhatsApp" },
  { id: "signal_vs", label: "33. Signal vs. WhatsApp — was Sie wirklich aufgeben" },
  { id: "disappearing", label: "34. Selbstlöschende Nachrichten — was wirklich gelöscht wird" },
  { id: "experts", label: "35. Was Experten, Gerichte und Whistleblower empfehlen" },
  { id: "sources", label: "Quellen und Belege" },
];

const TOC_IT: { id: string; label: string }[] = [
  { id: "risk-calc", label: "Il tuo punteggio di rischio personale su WhatsApp" },
  { id: "tldr", label: "In sintesi — cosa prova questo articolo" },
  { id: "owners", label: "1. Chi è il vero proprietario di WhatsApp" },
  { id: "founders", label: "2. Gli stessi fondatori se ne andarono per la privacy" },
  { id: "policy", label: "3. Cosa dice davvero l'Informativa sulla privacy" },
  { id: "metadata", label: "4. Metadati — ciò che la crittografia non nasconde" },
  { id: "y2021", label: "5. L'aggiornamento forzato del 2021" },
  { id: "backups", label: "6. La lacuna dei backup cloud" },
  { id: "business", label: "7. WhatsApp Business — dove l'E2EE finisce silenziosamente" },
  { id: "ads", label: "8. Pubblicità dentro WhatsApp (giugno 2025)" },
  { id: "ai", label: "9. Meta AI nella tua lista chat" },
  { id: "law", label: "10. Governi e forze dell'ordine" },
  { id: "pegasus", label: "11. Pegasus — la condanna da 167 mln $ a NSO" },
  { id: "victims", label: "12. Vittime di Pegasus per paese" },
  { id: "paragon", label: "13. Paragon Graphite (2025)" },
  { id: "leaks", label: "14. Fughe di dati, bug e funzioni difettose" },
  { id: "leak2022", label: "15. La fuga di 487 milioni di numeri (2022)" },
  { id: "fines", label: "16. Sanzioni normative e divieti" },
  { id: "bans", label: "17. Blocchi a livello nazionale" },
  { id: "lynch", label: "18. WhatsApp, fake news e linciaggi" },
  { id: "delete", label: "19. Cosa 'elimina account' cancella davvero" },
  { id: "scams", label: "20. Truffe su scala industriale" },
  { id: "verdict", label: "21. Il verdetto per gli utenti attenti alla privacy" },
  { id: "myanmar", label: "22. WhatsApp e il genocidio Rohingya" },
  { id: "brazil2018", label: "23. Brasile 2018 — WhatsApp come macchina di disinformazione" },
  { id: "whatsapppay", label: "24. WhatsApp Pay — i tuoi dati finanziari" },
  { id: "cves", label: "25. Vulnerabilità di sicurezza critiche (CVE)" },
  { id: "webdesktop", label: "26. WhatsApp Web e Desktop — superficie di attacco ampliata" },
  { id: "groups", label: "27. Gruppi WhatsApp — rischi collettivi per la privacy" },
  { id: "covid", label: "28. COVID-19 — WhatsApp come amplificatore di disinformazione" },
  { id: "haugen", label: "29. Frances Haugen e i documenti interni di Meta" },
  { id: "children", label: "30. Bambini su WhatsApp — verifica dell'età fallita" },
  { id: "dma", label: "31. Legge sui mercati digitali dell'UE e WhatsApp" },
  { id: "india_it_rules", label: "32. Norme IT India 2021 vs. WhatsApp" },
  { id: "signal_vs", label: "33. Signal vs. WhatsApp — cosa perdi davvero" },
  { id: "disappearing", label: "34. Messaggi temporanei — cosa viene davvero eliminato" },
  { id: "experts", label: "35. Cosa raccomandano esperti, tribunali e whistleblower" },
  { id: "sources", label: "Fonti e riferimenti" },
];

const TOC_AR: { id: string; label: string }[] = [
  { id: "risk-calc", label: "درجة مخاطر الخصوصية الشخصية على واتساب" },
  { id: "tldr", label: "باختصار — ما الذي يُثبته هذا المقال" },
  { id: "owners", label: "1. من يمتلك واتساب فعلياً" },
  { id: "founders", label: "2. المؤسسون أنفسهم غادروا بسبب الخصوصية" },
  { id: "policy", label: "3. ما تقوله سياسة الخصوصية فعلاً" },
  { id: "metadata", label: "4. البيانات الوصفية — ما لا يخفيه التشفير" },
  { id: "y2021", label: "5. تحديث 2021 الإجباري" },
  { id: "backups", label: "6. ثغرة النسخ الاحتياطي السحابي" },
  { id: "business", label: "7. واتساب للأعمال — حيث ينتهي E2EE بهدوء" },
  { id: "ads", label: "8. الإعلانات داخل واتساب (يونيو 2025)" },
  { id: "ai", label: "9. Meta AI في قائمة محادثاتك" },
  { id: "law", label: "10. الحكومات وجهات تطبيق القانون" },
  { id: "pegasus", label: "11. بيغاسوس — حكم 167 مليون دولار ضد NSO" },
  { id: "victims", label: "12. ضحايا بيغاسوس حسب البلد" },
  { id: "paragon", label: "13. Paragon Graphite (2025)" },
  { id: "leaks", label: "14. التسريبات والأخطاء والميزات المعطلة" },
  { id: "leak2022", label: "15. تسريب 487 مليون رقم (2022)" },
  { id: "fines", label: "16. الغرامات التنظيمية والحظر" },
  { id: "bans", label: "17. الحظر على المستوى الوطني" },
  { id: "lynch", label: "18. واتساب والأخبار الكاذبة وعمليات القتل الجماعي" },
  { id: "delete", label: "19. ما الذي يحذفه 'حذف الحساب' فعلاً" },
  { id: "scams", label: "20. عمليات نصب احتيال على نطاق صناعي" },
  { id: "verdict", label: "21. الحكم للمستخدمين الباحثين عن الخصوصية" },
  { id: "myanmar", label: "22. واتساب والإبادة الجماعية للروهينجا" },
  { id: "brazil2018", label: "23. البرازيل 2018 — واتساب كآلة تضليل" },
  { id: "whatsapppay", label: "24. واتساب باي — بياناتك المالية" },
  { id: "cves", label: "25. ثغرات الأمان الحرجة (CVE)" },
  { id: "webdesktop", label: "26. واتساب ويب وسطح المكتب — سطح هجوم أوسع" },
  { id: "groups", label: "27. مجموعات واتساب — مخاطر الخصوصية الجماعية" },
  { id: "covid", label: "28. كوفيد-19 — واتساب كمضخم للمعلومات المضللة" },
  { id: "haugen", label: "29. فرانسيس هاوغن ووثائق ميتا الداخلية" },
  { id: "children", label: "30. الأطفال على واتساب — فشل التحقق من العمر" },
  { id: "dma", label: "31. قانون الأسواق الرقمية الأوروبي وواتساب" },
  { id: "india_it_rules", label: "32. قواعد تكنولوجيا المعلومات الهندية 2021 مقابل واتساب" },
  { id: "signal_vs", label: "33. Signal مقابل واتساب — ما الذي تخسره فعلاً" },
  { id: "disappearing", label: "34. الرسائل المختفية — ما الذي يُحذف فعلاً" },
  { id: "experts", label: "35. ما يوصي به الخبراء والمحاكم والمُبلِّغون عن المخالفات" },
  { id: "sources", label: "المصادر والمراجع" },
];

const TOC_TR: { id: string; label: string }[] = [
  { id: "risk-calc", label: "Kişisel WhatsApp risk puanınız" },
  { id: "tldr", label: "Özet — bu makale neyi kanıtlıyor" },
  { id: "owners", label: "1. WhatsApp'ı gerçekte kim sahip" },
  { id: "founders", label: "2. Kurucuların kendisi gizlilik yüzünden ayrıldı" },
  { id: "policy", label: "3. Gizlilik Politikası gerçekte ne söylüyor" },
  { id: "metadata", label: "4. Meta veriler — şifrelemenin gizleyemediği şey" },
  { id: "y2021", label: "5. 2021'in zorla kabul ettirilen güncellemesi" },
  { id: "backups", label: "6. Bulut yedekleme açığı" },
  { id: "business", label: "7. WhatsApp Business — E2EE'nin sessizce bittiği yer" },
  { id: "ads", label: "8. WhatsApp içindeki reklamlar (Haziran 2025)" },
  { id: "ai", label: "9. Sohbet listenizde Meta AI" },
  { id: "law", label: "10. Hükümetler ve kolluk kuvvetleri" },
  { id: "pegasus", label: "11. Pegasus — NSO'ya 167 milyon dolar ceza" },
  { id: "victims", label: "12. Pegasus kurbanları ülkeye göre" },
  { id: "paragon", label: "13. Paragon Graphite (2025)" },
  { id: "leaks", label: "14. Veri sızıntıları, hatalar ve bozuk özellikler" },
  { id: "leak2022", label: "15. 487 milyon numaranın sızıntısı (2022)" },
  { id: "fines", label: "16. Düzenleyici para cezaları ve yasaklar" },
  { id: "bans", label: "17. Ulusal düzeyde yasaklar" },
  { id: "lynch", label: "18. WhatsApp, sahte haberler ve linç olayları" },
  { id: "delete", label: "19. 'Hesabı sil' aslında ne siliyor" },
  { id: "scams", label: "20. Endüstriyel ölçekte dolandırıcılık" },
  { id: "verdict", label: "21. Yüksek gizlilik isteyen kullanıcılar için sonuç" },
  { id: "myanmar", label: "22. WhatsApp ve Rohingya soykırımı" },
  { id: "brazil2018", label: "23. Brezilya 2018 — WhatsApp bir dezenformasyon makinesi olarak" },
  { id: "whatsapppay", label: "24. WhatsApp Pay — finansal verileriniz" },
  { id: "cves", label: "25. Kritik güvenlik açıkları (CVE'ler)" },
  { id: "webdesktop", label: "26. WhatsApp Web ve Masaüstü — genişleyen saldırı yüzeyi" },
  { id: "groups", label: "27. WhatsApp grupları — toplu gizlilik riskleri" },
  { id: "covid", label: "28. COVID-19 — WhatsApp bir dezenformasyon yükselticisi olarak" },
  { id: "haugen", label: "29. Frances Haugen ve Meta'nın iç belgeleri" },
  { id: "children", label: "30. WhatsApp'ta çocuklar — yaş doğrulamanın başarısızlığı" },
  { id: "dma", label: "31. AB Dijital Piyasalar Yasası ve WhatsApp" },
  { id: "india_it_rules", label: "32. Hindistan BT Kuralları 2021 vs. WhatsApp" },
  { id: "signal_vs", label: "33. Signal vs. WhatsApp — gerçekte ne kaybediyorsunuz" },
  { id: "disappearing", label: "34. Kaybolan mesajlar — gerçekte ne siliniyor" },
  { id: "experts", label: "35. Uzmanlar, mahkemeler ve ihbarcılar ne öneriyor" },
  { id: "sources", label: "Kaynaklar ve referanslar" },
];

const TOC_FR: { id: string; label: string }[] = [
  { id: "risk-calc", label: "Votre score de risque personnel sur WhatsApp" },
  { id: "tldr", label: "En résumé — ce que prouve cet article" },
  { id: "owners", label: "1. Qui possède vraiment WhatsApp" },
  { id: "founders", label: "2. Les fondateurs eux-mêmes sont partis pour la vie privée" },
  { id: "policy", label: "3. Ce que dit vraiment la Politique de confidentialité" },
  { id: "metadata", label: "4. Métadonnées — ce que le chiffrement ne cache pas" },
  { id: "y2021", label: "5. La mise à jour forcée de 2021" },
  { id: "backups", label: "6. La faille des sauvegardes cloud" },
  { id: "business", label: "7. WhatsApp Business — là où l'E2EE se termine silencieusement" },
  { id: "ads", label: "8. Publicités dans WhatsApp (juin 2025)" },
  { id: "ai", label: "9. Meta AI dans votre liste de conversations" },
  { id: "law", label: "10. Gouvernements et forces de l'ordre" },
  { id: "pegasus", label: "11. Pegasus — le verdict de 167 M$ contre NSO" },
  { id: "victims", label: "12. Victimes de Pegasus par pays" },
  { id: "paragon", label: "13. Paragon Graphite (2025)" },
  { id: "leaks", label: "14. Fuites, bugs et fonctionnalités défectueuses" },
  { id: "leak2022", label: "15. La fuite de 487 millions de numéros (2022)" },
  { id: "fines", label: "16. Amendes réglementaires et interdictions" },
  { id: "bans", label: "17. Blocages à l'échelle nationale" },
  { id: "lynch", label: "18. WhatsApp, fake news et lynchages" },
  { id: "delete", label: "19. Ce que « supprimer le compte » efface vraiment" },
  { id: "scams", label: "20. Arnaques à l'échelle industrielle" },
  { id: "verdict", label: "21. Le verdict pour les utilisateurs soucieux de leur vie privée" },
  { id: "myanmar", label: "22. WhatsApp et le génocide des Rohingyas" },
  { id: "brazil2018", label: "23. Brésil 2018 — WhatsApp comme machine à désinformation" },
  { id: "whatsapppay", label: "24. WhatsApp Pay — vos données financières" },
  { id: "cves", label: "25. Failles de sécurité critiques (CVE)" },
  { id: "webdesktop", label: "26. WhatsApp Web et Bureau — surface d'attaque élargie" },
  { id: "groups", label: "27. Groupes WhatsApp — risques collectifs pour la vie privée" },
  { id: "covid", label: "28. COVID-19 — WhatsApp comme amplificateur de désinformation" },
  { id: "haugen", label: "29. Frances Haugen et les documents internes de Meta" },
  { id: "children", label: "30. Les enfants sur WhatsApp — échec de la vérification d'âge" },
  { id: "dma", label: "31. Loi sur les marchés numériques de l'UE et WhatsApp" },
  { id: "india_it_rules", label: "32. Règles IT de l'Inde 2021 vs. WhatsApp" },
  { id: "signal_vs", label: "33. Signal vs. WhatsApp — ce que vous perdez vraiment" },
  { id: "disappearing", label: "34. Messages éphémères — ce qui est vraiment supprimé" },
  { id: "experts", label: "35. Ce que recommandent experts, tribunaux et lanceurs d'alerte" },
  { id: "sources", label: "Sources et références" },
];

const TOC_UR: { id: string; label: string }[] = [
  { id: "risk-calc", label: "واٹس ایپ پر آپ کا ذاتی رسک اسکور" },
  { id: "tldr", label: "خلاصہ — یہ مضمون کیا ثابت کرتا ہے" },
  { id: "owners", label: "1. واٹس ایپ کا اصل مالک کون ہے" },
  { id: "founders", label: "2. بانیوں نے خود پرائیویسی پر میٹا سے اختلاف کیا" },
  { id: "policy", label: "3. پرائیویسی پالیسی اصل میں کیا کہتی ہے" },
  { id: "metadata", label: "4. میٹا ڈیٹا — جو انکرپشن چھپا نہیں سکتی" },
  { id: "y2021", label: "5. 2021 کی جبری پالیسی اپڈیٹ" },
  { id: "backups", label: "6. کلاؤڈ بیک اپ کی کمزوری" },
  { id: "business", label: "7. واٹس ایپ بزنس — جہاں E2EE خاموشی سے ختم ہوتی ہے" },
  { id: "ads", label: "8. واٹس ایپ کے اندر اشتہارات (جون 2025)" },
  { id: "ai", label: "9. آپ کی چیٹ لسٹ میں Meta AI" },
  { id: "law", label: "10. حکومتیں اور قانون نافذ کرنے والے ادارے" },
  { id: "pegasus", label: "11. پیگاسس — 167 ملین ڈالر کا NSO فیصلہ" },
  { id: "victims", label: "12. پیگاسس کے متاثرین ملک بہ ملک" },
  { id: "paragon", label: "13. Paragon Graphite (2025)" },
  { id: "leaks", label: "14. لیکس، بگز اور ٹوٹی ہوئی خصوصیات" },
  { id: "leak2022", label: "15. 487 ملین نمبروں کا لیک (2022)" },
  { id: "fines", label: "16. ریگولیٹری جرمانے اور پابندیاں" },
  { id: "bans", label: "17. ملکی سطح پر پابندیاں" },
  { id: "lynch", label: "18. واٹس ایپ، جھوٹی خبریں اور ہجومی تشدد" },
  { id: "delete", label: "19. 'اکاؤنٹ ڈیلیٹ' اصل میں کیا ڈیلیٹ کرتا ہے" },
  { id: "scams", label: "20. صنعتی پیمانے پر فراڈ" },
  { id: "verdict", label: "21. اعلی پرائیویسی صارفین کے لیے نتیجہ" },
  { id: "myanmar", label: "22. واٹس ایپ اور روہنگیا نسل کشی" },
  { id: "brazil2018", label: "23. برازیل 2018 — واٹس ایپ غلط معلومات کی مشین کے طور پر" },
  { id: "whatsapppay", label: "24. واٹس ایپ پے — آپ کا مالی ڈیٹا" },
  { id: "cves", label: "25. سنگین سیکیورٹی کمزوریاں (CVE)" },
  { id: "webdesktop", label: "26. واٹس ایپ ویب اور ڈیسک ٹاپ — وسیع حملے کا میدان" },
  { id: "groups", label: "27. واٹس ایپ گروپس — اجتماعی پرائیویسی خطرات" },
  { id: "covid", label: "28. COVID-19 — واٹس ایپ غلط معلومات کا ایمپلیفائر" },
  { id: "haugen", label: "29. فرانسس ہاؤگن اور میٹا کی اندرونی دستاویزات" },
  { id: "children", label: "30. واٹس ایپ پر بچے — عمر کی تصدیق میں ناکامی" },
  { id: "dma", label: "31. EU ڈیجیٹل مارکیٹس ایکٹ اور واٹس ایپ" },
  { id: "india_it_rules", label: "32. بھارت کے IT قوانین 2021 بمقابلہ واٹس ایپ" },
  { id: "signal_vs", label: "33. Signal بمقابلہ واٹس ایپ — آپ اصل میں کیا کھوتے ہیں" },
  { id: "disappearing", label: "34. غائب ہونے والے پیغامات — اصل میں کیا ڈیلیٹ ہوتا ہے" },
  { id: "experts", label: "35. ماہرین، عدالتیں اور وِسل بلوئرز کیا کہتے ہیں" },
  { id: "sources", label: "ذرائع اور حوالہ جات" },
];

/* ───────────────────────────── RISK CALCULATOR ───────────────────────────── */

type RiskQuestion = {
  id: string;
  question: string;
  options: { label: string; score: number }[];
};

const RISK_QUESTIONS_EN: RiskQuestion[] = [
  {
    id: "backup",
    question: "Do you use WhatsApp's cloud backup (Google Drive or iCloud)?",
    options: [
      { label: "No — I never back up WhatsApp", score: 0 },
      { label: "Yes — with end-to-end encrypted backup switched ON", score: 1 },
      { label: "Yes — standard backup (not E2EE)", score: 3 },
      { label: "I don't know / haven't checked", score: 2 },
    ],
  },
  {
    id: "business",
    question: "Do you message businesses through WhatsApp (banks, airlines, delivery, government offices, etc.)?",
    options: [
      { label: "Never", score: 0 },
      { label: "Rarely — once a month or less", score: 1 },
      { label: "Regularly — a few times per week", score: 2 },
      { label: "It's how I mainly contact companies", score: 3 },
    ],
  },
  {
    id: "web",
    question: "Do you use WhatsApp Web or WhatsApp Desktop?",
    options: [
      { label: "Never", score: 0 },
      { label: "Occasionally, and I always log out after", score: 1 },
      { label: "Daily — but I close the session when done", score: 2 },
      { label: "I leave sessions open permanently", score: 3 },
    ],
  },
  {
    id: "groups",
    question: "How many large WhatsApp groups (50+ members) are you in?",
    options: [
      { label: "None", score: 0 },
      { label: "1–2 groups", score: 1 },
      { label: "3–5 groups", score: 2 },
      { label: "6 or more groups", score: 3 },
    ],
  },
  {
    id: "pay",
    question: "Do you use WhatsApp Pay or send money via WhatsApp?",
    options: [
      { label: "Never", score: 0 },
      { label: "Rarely", score: 1 },
      { label: "Sometimes", score: 2 },
      { label: "Regularly — it's my main UPI/payment method", score: 3 },
    ],
  },
];

const RISK_QUESTIONS_HI: RiskQuestion[] = [
  {
    id: "backup",
    question: "क्या आप WhatsApp का cloud backup (Google Drive या iCloud) इस्तेमाल करते हैं?",
    options: [
      { label: "नहीं — मैं कभी backup नहीं करता/करती", score: 0 },
      { label: "हाँ — end-to-end encrypted backup चालू करके", score: 1 },
      { label: "हाँ — standard backup (E2EE नहीं)", score: 3 },
      { label: "पता नहीं / कभी check नहीं किया", score: 2 },
    ],
  },
  {
    id: "business",
    question: "क्या आप WhatsApp पर businesses (बैंक, airline, डिलीवरी, सरकारी दफ़्तर आदि) को मैसेज करते हैं?",
    options: [
      { label: "कभी नहीं", score: 0 },
      { label: "कभी-कभार — महीने में एक बार या कम", score: 1 },
      { label: "नियमित रूप से — हफ़्ते में कई बार", score: 2 },
      { label: "यही मुख्य तरीक़ा है — companies से ज़्यादातर WhatsApp पर बात होती है", score: 3 },
    ],
  },
  {
    id: "web",
    question: "क्या आप WhatsApp Web या WhatsApp Desktop इस्तेमाल करते हैं?",
    options: [
      { label: "कभी नहीं", score: 0 },
      { label: "कभी-कभार — और logout भी करता/करती हूँ", score: 1 },
      { label: "रोज़ — पर काम खत्म होने पर बंद करता/करती हूँ", score: 2 },
      { label: "Session हमेशा open रखता/रखती हूँ", score: 3 },
    ],
  },
  {
    id: "groups",
    question: "आप कितने बड़े WhatsApp Groups (50+ members) में हैं?",
    options: [
      { label: "एक भी नहीं", score: 0 },
      { label: "1–2 groups", score: 1 },
      { label: "3–5 groups", score: 2 },
      { label: "6 या उससे ज़्यादा", score: 3 },
    ],
  },
  {
    id: "pay",
    question: "क्या आप WhatsApp Pay इस्तेमाल करते हैं या WhatsApp से पैसे भेजते/लेते हैं?",
    options: [
      { label: "कभी नहीं", score: 0 },
      { label: "कभी-कभार", score: 1 },
      { label: "कभी-कभी", score: 2 },
      { label: "नियमित रूप से — यही मुख्य UPI/payment तरीक़ा है", score: 3 },
    ],
  },
];

const RISK_QUESTIONS_PT: RiskQuestion[] = [
  { id: "backup", question: "Você usa o backup em nuvem do WhatsApp (Google Drive ou iCloud)?", options: [
    { label: "Não — nunca faço backup do WhatsApp", score: 0 },
    { label: "Sim — com backup E2EE ativado", score: 1 },
    { label: "Sim — backup padrão (sem E2EE)", score: 3 },
    { label: "Não sei / nunca verifiquei", score: 2 },
  ]},
  { id: "business", question: "Você envia mensagens para empresas pelo WhatsApp (bancos, companhias aéreas, entrega, governo)?", options: [
    { label: "Nunca", score: 0 },
    { label: "Raramente — uma vez por mês ou menos", score: 1 },
    { label: "Regularmente — algumas vezes por semana", score: 2 },
    { label: "É como me comunico principalmente com empresas", score: 3 },
  ]},
  { id: "web", question: "Você usa o WhatsApp Web ou WhatsApp Desktop?", options: [
    { label: "Nunca", score: 0 },
    { label: "Ocasionalmente e sempre faço logout", score: 1 },
    { label: "Diariamente, mas encerro a sessão quando termino", score: 2 },
    { label: "Deixo as sessões abertas permanentemente", score: 3 },
  ]},
  { id: "groups", question: "Em quantos grupos grandes do WhatsApp (50+ membros) você participa?", options: [
    { label: "Nenhum", score: 0 },
    { label: "1–2 grupos", score: 1 },
    { label: "3–5 grupos", score: 2 },
    { label: "6 ou mais grupos", score: 3 },
  ]},
  { id: "pay", question: "Você usa o WhatsApp Pay ou envia dinheiro pelo WhatsApp?", options: [
    { label: "Nunca", score: 0 },
    { label: "Raramente", score: 1 },
    { label: "Às vezes", score: 2 },
    { label: "Regularmente — é meu método de pagamento principal", score: 3 },
  ]},
];

const RISK_QUESTIONS_ID: RiskQuestion[] = [
  { id: "backup", question: "Apakah Anda menggunakan backup cloud WhatsApp (Google Drive atau iCloud)?", options: [
    { label: "Tidak — saya tidak pernah backup WhatsApp", score: 0 },
    { label: "Ya — dengan backup E2EE diaktifkan", score: 1 },
    { label: "Ya — backup standar (bukan E2EE)", score: 3 },
    { label: "Tidak tahu / belum pernah cek", score: 2 },
  ]},
  { id: "business", question: "Apakah Anda mengirim pesan ke bisnis melalui WhatsApp (bank, maskapai, pengiriman, kantor pemerintah)?", options: [
    { label: "Tidak pernah", score: 0 },
    { label: "Jarang — sebulan sekali atau lebih jarang", score: 1 },
    { label: "Rutin — beberapa kali seminggu", score: 2 },
    { label: "Itu cara utama saya menghubungi perusahaan", score: 3 },
  ]},
  { id: "web", question: "Apakah Anda menggunakan WhatsApp Web atau WhatsApp Desktop?", options: [
    { label: "Tidak pernah", score: 0 },
    { label: "Sesekali dan selalu logout setelahnya", score: 1 },
    { label: "Setiap hari — tapi saya tutup sesi setelah selesai", score: 2 },
    { label: "Saya biarkan sesi terbuka terus-menerus", score: 3 },
  ]},
  { id: "groups", question: "Berapa banyak grup WhatsApp besar (50+ anggota) yang Anda ikuti?", options: [
    { label: "Tidak ada", score: 0 },
    { label: "1–2 grup", score: 1 },
    { label: "3–5 grup", score: 2 },
    { label: "6 grup atau lebih", score: 3 },
  ]},
  { id: "pay", question: "Apakah Anda menggunakan WhatsApp Pay atau mengirim uang melalui WhatsApp?", options: [
    { label: "Tidak pernah", score: 0 },
    { label: "Jarang", score: 1 },
    { label: "Kadang-kadang", score: 2 },
    { label: "Rutin — itu metode pembayaran utama saya", score: 3 },
  ]},
];

const RISK_QUESTIONS_ES: RiskQuestion[] = [
  { id: "backup", question: "¿Usas la copia de seguridad en la nube de WhatsApp (Google Drive o iCloud)?", options: [
    { label: "No — nunca hago copias de seguridad de WhatsApp", score: 0 },
    { label: "Sí — con copia de seguridad E2EE activada", score: 1 },
    { label: "Sí — copia de seguridad estándar (sin E2EE)", score: 3 },
    { label: "No lo sé / nunca lo he comprobado", score: 2 },
  ]},
  { id: "business", question: "¿Envías mensajes a empresas a través de WhatsApp (bancos, aerolíneas, entregas, oficinas gubernamentales)?", options: [
    { label: "Nunca", score: 0 },
    { label: "Raramente — una vez al mes o menos", score: 1 },
    { label: "Regularmente — varias veces por semana", score: 2 },
    { label: "Es mi forma principal de contactar empresas", score: 3 },
  ]},
  { id: "web", question: "¿Usas WhatsApp Web o WhatsApp Desktop?", options: [
    { label: "Nunca", score: 0 },
    { label: "Ocasionalmente y siempre cierro sesión después", score: 1 },
    { label: "A diario — pero cierro la sesión cuando termino", score: 2 },
    { label: "Dejo las sesiones abiertas permanentemente", score: 3 },
  ]},
  { id: "groups", question: "¿En cuántos grupos grandes de WhatsApp (50+ miembros) participas?", options: [
    { label: "Ninguno", score: 0 },
    { label: "1–2 grupos", score: 1 },
    { label: "3–5 grupos", score: 2 },
    { label: "6 o más grupos", score: 3 },
  ]},
  { id: "pay", question: "¿Usas WhatsApp Pay o envías dinero por WhatsApp?", options: [
    { label: "Nunca", score: 0 },
    { label: "Raramente", score: 1 },
    { label: "A veces", score: 2 },
    { label: "Regularmente — es mi método de pago principal", score: 3 },
  ]},
];

const RISK_QUESTIONS_RU: RiskQuestion[] = [
  { id: "backup", question: "Вы используете облачное резервное копирование WhatsApp (Google Drive или iCloud)?", options: [
    { label: "Нет — я никогда не делаю резервные копии WhatsApp", score: 0 },
    { label: "Да — с включённым E2EE-резервным копированием", score: 1 },
    { label: "Да — стандартное резервное копирование (без E2EE)", score: 3 },
    { label: "Не знаю / никогда не проверял(а)", score: 2 },
  ]},
  { id: "business", question: "Вы пишете в WhatsApp компаниям (банки, авиалинии, доставка, госорганы)?", options: [
    { label: "Никогда", score: 0 },
    { label: "Редко — раз в месяц или реже", score: 1 },
    { label: "Регулярно — несколько раз в неделю", score: 2 },
    { label: "Это основной способ связи с компаниями", score: 3 },
  ]},
  { id: "web", question: "Вы используете WhatsApp Web или WhatsApp Desktop?", options: [
    { label: "Никогда", score: 0 },
    { label: "Иногда, и всегда выхожу из системы после", score: 1 },
    { label: "Ежедневно — но закрываю сессию, когда заканчиваю", score: 2 },
    { label: "Я оставляю сессии постоянно открытыми", score: 3 },
  ]},
  { id: "groups", question: "В скольких больших группах WhatsApp (50+ участников) вы состоите?", options: [
    { label: "Ни в одной", score: 0 },
    { label: "1–2 группы", score: 1 },
    { label: "3–5 групп", score: 2 },
    { label: "6 или более групп", score: 3 },
  ]},
  { id: "pay", question: "Вы используете WhatsApp Pay или отправляете деньги через WhatsApp?", options: [
    { label: "Никогда", score: 0 },
    { label: "Редко", score: 1 },
    { label: "Иногда", score: 2 },
    { label: "Регулярно — это основной способ оплаты", score: 3 },
  ]},
];

const RISK_QUESTIONS_DE: RiskQuestion[] = [
  { id: "backup", question: "Nutzen Sie das Cloud-Backup von WhatsApp (Google Drive oder iCloud)?", options: [
    { label: "Nein — ich mache nie ein WhatsApp-Backup", score: 0 },
    { label: "Ja — mit aktivierter E2EE-Sicherung", score: 1 },
    { label: "Ja — Standard-Backup (kein E2EE)", score: 3 },
    { label: "Weiß ich nicht / habe ich nie geprüft", score: 2 },
  ]},
  { id: "business", question: "Schreiben Sie Unternehmen über WhatsApp (Banken, Airlines, Lieferung, Behörden)?", options: [
    { label: "Nie", score: 0 },
    { label: "Selten — einmal im Monat oder seltener", score: 1 },
    { label: "Regelmäßig — mehrmals pro Woche", score: 2 },
    { label: "So kontaktiere ich Unternehmen hauptsächlich", score: 3 },
  ]},
  { id: "web", question: "Nutzen Sie WhatsApp Web oder WhatsApp Desktop?", options: [
    { label: "Nie", score: 0 },
    { label: "Gelegentlich und melde mich danach immer ab", score: 1 },
    { label: "Täglich — aber schließe die Sitzung, wenn ich fertig bin", score: 2 },
    { label: "Ich lasse Sitzungen dauerhaft offen", score: 3 },
  ]},
  { id: "groups", question: "In wie vielen großen WhatsApp-Gruppen (50+ Mitglieder) sind Sie?", options: [
    { label: "Keine", score: 0 },
    { label: "1–2 Gruppen", score: 1 },
    { label: "3–5 Gruppen", score: 2 },
    { label: "6 oder mehr Gruppen", score: 3 },
  ]},
  { id: "pay", question: "Nutzen Sie WhatsApp Pay oder senden Sie Geld über WhatsApp?", options: [
    { label: "Nie", score: 0 },
    { label: "Selten", score: 1 },
    { label: "Manchmal", score: 2 },
    { label: "Regelmäßig — es ist meine Hauptzahlungsmethode", score: 3 },
  ]},
];

const RISK_QUESTIONS_IT: RiskQuestion[] = [
  { id: "backup", question: "Usi il backup cloud di WhatsApp (Google Drive o iCloud)?", options: [
    { label: "No — non faccio mai backup di WhatsApp", score: 0 },
    { label: "Sì — con il backup E2EE attivato", score: 1 },
    { label: "Sì — backup standard (senza E2EE)", score: 3 },
    { label: "Non lo so / non l'ho mai controllato", score: 2 },
  ]},
  { id: "business", question: "Scrivi ad aziende tramite WhatsApp (banche, compagnie aeree, corrieri, uffici pubblici)?", options: [
    { label: "Mai", score: 0 },
    { label: "Raramente — una volta al mese o meno", score: 1 },
    { label: "Regolarmente — alcune volte a settimana", score: 2 },
    { label: "È il mio modo principale di contattare le aziende", score: 3 },
  ]},
  { id: "web", question: "Usi WhatsApp Web o WhatsApp Desktop?", options: [
    { label: "Mai", score: 0 },
    { label: "Occasionalmente e faccio sempre il logout", score: 1 },
    { label: "Ogni giorno — ma chiudo la sessione quando finisco", score: 2 },
    { label: "Lascio le sessioni aperte in modo permanente", score: 3 },
  ]},
  { id: "groups", question: "In quanti gruppi WhatsApp grandi (50+ membri) sei?", options: [
    { label: "Nessuno", score: 0 },
    { label: "1–2 gruppi", score: 1 },
    { label: "3–5 gruppi", score: 2 },
    { label: "6 o più gruppi", score: 3 },
  ]},
  { id: "pay", question: "Usi WhatsApp Pay o invii denaro tramite WhatsApp?", options: [
    { label: "Mai", score: 0 },
    { label: "Raramente", score: 1 },
    { label: "A volte", score: 2 },
    { label: "Regolarmente — è il mio principale metodo di pagamento", score: 3 },
  ]},
];

const RISK_QUESTIONS_AR: RiskQuestion[] = [
  { id: "backup", question: "هل تستخدم النسخ الاحتياطي السحابي لواتساب (Google Drive أو iCloud)؟", options: [
    { label: "لا — لا أقوم بأي نسخ احتياطي لواتساب", score: 0 },
    { label: "نعم — مع تفعيل النسخ الاحتياطي المشفر E2EE", score: 1 },
    { label: "نعم — نسخ احتياطي عادي (بدون E2EE)", score: 3 },
    { label: "لا أعرف / لم أتحقق من ذلك", score: 2 },
  ]},
  { id: "business", question: "هل ترسل رسائل إلى الشركات عبر واتساب (البنوك، الطيران، التوصيل، الجهات الحكومية)؟", options: [
    { label: "أبداً", score: 0 },
    { label: "نادراً — مرة في الشهر أو أقل", score: 1 },
    { label: "بانتظام — عدة مرات في الأسبوع", score: 2 },
    { label: "هذه طريقتي الرئيسية للتواصل مع الشركات", score: 3 },
  ]},
  { id: "web", question: "هل تستخدم واتساب ويب أو واتساب ديسك توب؟", options: [
    { label: "أبداً", score: 0 },
    { label: "أحياناً وأسجل خروجي دائماً بعد الانتهاء", score: 1 },
    { label: "يومياً — لكن أُغلق الجلسة عند الانتهاء", score: 2 },
    { label: "أترك الجلسات مفتوحة بشكل دائم", score: 3 },
  ]},
  { id: "groups", question: "كم عدد مجموعات واتساب الكبيرة (50+ عضو) التي تنتمي إليها؟", options: [
    { label: "لا أحد", score: 0 },
    { label: "1–2 مجموعة", score: 1 },
    { label: "3–5 مجموعات", score: 2 },
    { label: "6 مجموعات أو أكثر", score: 3 },
  ]},
  { id: "pay", question: "هل تستخدم واتساب باي أو ترسل أموالاً عبر واتساب؟", options: [
    { label: "أبداً", score: 0 },
    { label: "نادراً", score: 1 },
    { label: "أحياناً", score: 2 },
    { label: "بانتظام — إنها طريقتي الرئيسية للدفع", score: 3 },
  ]},
];

const RISK_QUESTIONS_TR: RiskQuestion[] = [
  { id: "backup", question: "WhatsApp'ın bulut yedeklemesini (Google Drive veya iCloud) kullanıyor musunuz?", options: [
    { label: "Hayır — WhatsApp'ı hiç yedeklemiyorum", score: 0 },
    { label: "Evet — E2EE yedekleme açık", score: 1 },
    { label: "Evet — standart yedekleme (E2EE yok)", score: 3 },
    { label: "Bilmiyorum / hiç kontrol etmedim", score: 2 },
  ]},
  { id: "business", question: "WhatsApp üzerinden işletmelere (bankalar, havayolları, kargo, devlet kurumları) mesaj atıyor musunuz?", options: [
    { label: "Hiçbir zaman", score: 0 },
    { label: "Nadiren — ayda bir kez veya daha az", score: 1 },
    { label: "Düzenli olarak — haftada birkaç kez", score: 2 },
    { label: "Şirketlerle iletişimimin büyük çoğunluğu böyle", score: 3 },
  ]},
  { id: "web", question: "WhatsApp Web veya WhatsApp Desktop kullanıyor musunuz?", options: [
    { label: "Hiçbir zaman", score: 0 },
    { label: "Ara sıra ve her seferinde çıkış yapıyorum", score: 1 },
    { label: "Her gün — ama işim bitince oturumu kapatıyorum", score: 2 },
    { label: "Oturumları kalıcı olarak açık bırakıyorum", score: 3 },
  ]},
  { id: "groups", question: "Kaç büyük WhatsApp grubunda (50+ üye) yer alıyorsunuz?", options: [
    { label: "Hiçbirinde", score: 0 },
    { label: "1–2 grup", score: 1 },
    { label: "3–5 grup", score: 2 },
    { label: "6 veya daha fazla grup", score: 3 },
  ]},
  { id: "pay", question: "WhatsApp Pay kullanıyor veya WhatsApp üzerinden para gönderiyor musunuz?", options: [
    { label: "Hiçbir zaman", score: 0 },
    { label: "Nadiren", score: 1 },
    { label: "Bazen", score: 2 },
    { label: "Düzenli olarak — ana ödeme yöntemim bu", score: 3 },
  ]},
];

const RISK_QUESTIONS_FR: RiskQuestion[] = [
  { id: "backup", question: "Utilisez-vous la sauvegarde cloud de WhatsApp (Google Drive ou iCloud) ?", options: [
    { label: "Non — je ne sauvegarde jamais WhatsApp", score: 0 },
    { label: "Oui — avec la sauvegarde E2EE activée", score: 1 },
    { label: "Oui — sauvegarde standard (sans E2EE)", score: 3 },
    { label: "Je ne sais pas / je n'ai jamais vérifié", score: 2 },
  ]},
  { id: "business", question: "Envoyez-vous des messages à des entreprises via WhatsApp (banques, compagnies aériennes, livraison, administrations) ?", options: [
    { label: "Jamais", score: 0 },
    { label: "Rarement — une fois par mois ou moins", score: 1 },
    { label: "Régulièrement — plusieurs fois par semaine", score: 2 },
    { label: "C'est ma façon principale de contacter les entreprises", score: 3 },
  ]},
  { id: "web", question: "Utilisez-vous WhatsApp Web ou WhatsApp Desktop ?", options: [
    { label: "Jamais", score: 0 },
    { label: "Occasionnellement et je me déconnecte toujours après", score: 1 },
    { label: "Quotidiennement — mais je ferme la session à la fin", score: 2 },
    { label: "Je laisse les sessions ouvertes en permanence", score: 3 },
  ]},
  { id: "groups", question: "Dans combien de grands groupes WhatsApp (50+ membres) êtes-vous ?", options: [
    { label: "Aucun", score: 0 },
    { label: "1–2 groupes", score: 1 },
    { label: "3–5 groupes", score: 2 },
    { label: "6 groupes ou plus", score: 3 },
  ]},
  { id: "pay", question: "Utilisez-vous WhatsApp Pay ou envoyez-vous de l'argent via WhatsApp ?", options: [
    { label: "Jamais", score: 0 },
    { label: "Rarement", score: 1 },
    { label: "Parfois", score: 2 },
    { label: "Régulièrement — c'est mon principal moyen de paiement", score: 3 },
  ]},
];

const RISK_QUESTIONS_UR: RiskQuestion[] = [
  { id: "backup", question: "کیا آپ واٹس ایپ کا کلاؤڈ بیک اپ (Google Drive یا iCloud) استعمال کرتے ہیں؟", options: [
    { label: "نہیں — میں کبھی بھی واٹس ایپ بیک اپ نہیں لیتا/لیتی", score: 0 },
    { label: "ہاں — E2EE بیک اپ آن کر کے", score: 1 },
    { label: "ہاں — عام بیک اپ (E2EE نہیں)", score: 3 },
    { label: "مجھے نہیں معلوم / کبھی چیک نہیں کیا", score: 2 },
  ]},
  { id: "business", question: "کیا آپ واٹس ایپ پر کاروباروں (بینک، ایئرلائن، ڈیلیوری، سرکاری دفاتر) کو میسج کرتے ہیں؟", options: [
    { label: "کبھی نہیں", score: 0 },
    { label: "کبھی کبھار — مہینے میں ایک بار یا کم", score: 1 },
    { label: "باقاعدگی سے — ہفتے میں کئی بار", score: 2 },
    { label: "یہی کمپنیوں سے رابطے کا میرا مرکزی طریقہ ہے", score: 3 },
  ]},
  { id: "web", question: "کیا آپ واٹس ایپ ویب یا واٹس ایپ ڈیسک ٹاپ استعمال کرتے ہیں؟", options: [
    { label: "کبھی نہیں", score: 0 },
    { label: "کبھی کبھار — اور ہمیشہ لاگ آؤٹ کرتا/کرتی ہوں", score: 1 },
    { label: "روزانہ — لیکن کام ختم ہونے پر سیشن بند کرتا/کرتی ہوں", score: 2 },
    { label: "سیشن ہمیشہ کھلے رکھتا/رکھتی ہوں", score: 3 },
  ]},
  { id: "groups", question: "آپ کتنے بڑے واٹس ایپ گروپس (50+ ارکان) میں ہیں؟", options: [
    { label: "کوئی نہیں", score: 0 },
    { label: "1–2 گروپس", score: 1 },
    { label: "3–5 گروپس", score: 2 },
    { label: "6 یا اس سے زیادہ", score: 3 },
  ]},
  { id: "pay", question: "کیا آپ واٹس ایپ پے استعمال کرتے ہیں یا واٹس ایپ سے پیسے بھیجتے/لیتے ہیں؟", options: [
    { label: "کبھی نہیں", score: 0 },
    { label: "کبھی کبھار", score: 1 },
    { label: "کبھی کبھی", score: 2 },
    { label: "باقاعدگی سے — یہی میرا مرکزی ادائیگی کا طریقہ ہے", score: 3 },
  ]},
];

type RiskLevel = "low" | "moderate" | "high" | "critical";

function getRiskLevel(score: number): RiskLevel {
  if (score <= 3) return "low";
  if (score <= 7) return "moderate";
  if (score <= 11) return "high";
  return "critical";
}

const RISK_RESULTS_EN: Record<RiskLevel, { label: string; color: string; bg: string; border: string; summary: string; tips: string[] }> = {
  low: {
    label: "Low Risk",
    color: "#1a6b3a",
    bg: "#f0faf3",
    border: "#2E6F40",
    summary: "Your WhatsApp usage practices are relatively privacy-conscious. You're likely avoiding the biggest metadata traps. That said, even low-risk users share their phone number, contacts, IP, and device info with Meta — so this score reflects practices, not absolute safety.",
    tips: [
      "Confirm your E2EE backup is switched on in Settings → Chats → Chat Backup.",
      "Periodically review WhatsApp Web sessions via Settings → Linked Devices.",
      "Review which groups you're in — even non-active membership exposes your number.",
    ],
  },
  moderate: {
    label: "Moderate Risk",
    color: "#8a5a00",
    bg: "#fffbea",
    border: "#d4a017",
    summary: "Your usage patterns expose you to meaningful metadata collection and some structural privacy risks. One or more of your habits — business messaging, cloud backup, or group size — significantly extend the data trail Meta can build about you.",
    tips: [
      "Enable end-to-end encrypted backup immediately in Settings → Chats → Chat Backup.",
      "When messaging businesses, assume Meta can see that conversation and act accordingly.",
      "Log out of WhatsApp Web sessions when not actively using them.",
    ],
  },
  high: {
    label: "High Risk",
    color: "#8a2c00",
    bg: "#fff3ed",
    border: "#d45a17",
    summary: "Multiple high-risk habits compound into a substantial privacy exposure. Your communication patterns, financial behaviour, and network are being extensively profiled. The data trail Meta holds about you is significantly richer than most users realise.",
    tips: [
      "Enable E2EE backup or turn off cloud backup entirely.",
      "Log out of all WhatsApp Web sessions permanently — use mobile only.",
      "Leave large groups whose membership you don't personally know.",
      "Consider separating financial transactions from your WhatsApp identity.",
      "Read the Verdict section (§21) and the Signal comparison (§33).",
    ],
  },
  critical: {
    label: "Very High Risk",
    color: "#6e0000",
    bg: "#fdecec",
    border: "#c2453a",
    summary: "Your current WhatsApp usage creates one of the most comprehensive data profiles possible within the Meta ecosystem. You are sharing communication patterns, financial data, device fingerprinting, and group membership at a level that gives Meta — and, by extension, law enforcement and advertisers — an unusually detailed picture of your life.",
    tips: [
      "Disable cloud backup entirely, or switch to E2EE backup with a strong, stored password.",
      "Log out of all linked WhatsApp Web and Desktop sessions immediately.",
      "Leave high-membership groups where you don't know most members.",
      "Stop using WhatsApp Pay — use a separate app for financial transactions.",
      "Read §33 (Signal vs. WhatsApp) and seriously consider migrating high-privacy conversations to Signal.",
      "Read §19 (delete account) before taking any action — understand what will and won't be erased.",
    ],
  },
};

const RISK_RESULTS_HI: Record<RiskLevel, { label: string; color: string; bg: string; border: string; summary: string; tips: string[] }> = {
  low: {
    label: "कम जोखिम",
    color: "#1a6b3a",
    bg: "#f0faf3",
    border: "#2E6F40",
    summary: "आपकी WhatsApp इस्तेमाल की आदतें अपेक्षाकृत privacy-conscious हैं। आप सबसे बड़े metadata traps से बचते हैं। फिर भी, कम जोखिम वाले users भी अपना phone number, contacts, IP और device info Meta के साथ share करते हैं — यह score practices को दर्शाता है, पूर्ण सुरक्षा को नहीं।",
    tips: [
      "Settings → Chats → Chat Backup में E2EE backup चालू है या नहीं, verify करें।",
      "Settings → Linked Devices में WhatsApp Web sessions की समय-समय पर जाँच करें।",
      "जिन groups में आप inactive हैं, उनसे exit करें — membership भी आपका number expose करती है।",
    ],
  },
  moderate: {
    label: "मध्यम जोखिम",
    color: "#8a5a00",
    bg: "#fffbea",
    border: "#d4a017",
    summary: "आपकी usage patterns आपको meaningful metadata collection और कुछ structural privacy risks के सामने रखती हैं। Business messaging, cloud backup, या group size में से एक या अधिक आदतें Meta द्वारा बनाई जाने वाले data trail को काफ़ी बढ़ा देती हैं।",
    tips: [
      "तुरंत Settings → Chats → Chat Backup में end-to-end encrypted backup चालू करें।",
      "Businesses को message करते समय मान लें कि Meta उस बातचीत को देख सकता है।",
      "WhatsApp Web sessions का उपयोग न होने पर logout करें।",
    ],
  },
  high: {
    label: "उच्च जोखिम",
    color: "#8a2c00",
    bg: "#fff3ed",
    border: "#d45a17",
    summary: "कई high-risk आदतें मिलकर एक बड़ा privacy exposure बनाती हैं। आपके communication patterns, financial behaviour और network की व्यापक profiling हो रही है। Meta के पास आपके बारे में data trail ज़्यादातर users की सोच से कहीं अधिक समृद्ध है।",
    tips: [
      "E2EE backup चालू करें या cloud backup पूरी तरह बंद करें।",
      "सभी WhatsApp Web sessions से logout करें।",
      "बड़े groups जहाँ आप personally सदस्यों को नहीं जानते, उन्हें छोड़ें।",
      "Financial transactions को WhatsApp identity से अलग करने पर विचार करें।",
      "§21 (Verdict) और §33 (Signal vs. WhatsApp) ज़रूर पढ़ें।",
    ],
  },
  critical: {
    label: "बहुत उच्च जोखिम",
    color: "#6e0000",
    bg: "#fdecec",
    border: "#c2453a",
    summary: "आपकी WhatsApp usage Meta ecosystem में सबसे व्यापक data profiles में से एक बनाती है। आप communication patterns, financial data, device fingerprinting और group membership इस स्तर पर share कर रहे हैं जो Meta — और इसके ज़रिए law enforcement और advertisers — को आपकी ज़िंदगी की असाधारण रूप से विस्तृत तस्वीर देता है।",
    tips: [
      "Cloud backup पूरी तरह बंद करें, या एक strong password के साथ E2EE backup चालू करें।",
      "सभी linked WhatsApp Web और Desktop sessions तुरंत logout करें।",
      "अधिकांश सदस्यों को न जानने वाले बड़े groups छोड़ें।",
      "WhatsApp Pay बंद करें — financial transactions के लिए अलग app इस्तेमाल करें।",
      "§33 (Signal vs. WhatsApp) पढ़ें और high-privacy बातचीत Signal पर migrate करने पर विचार करें।",
      "कोई कदम उठाने से पहले §19 (delete account) पढ़ें।",
    ],
  },
};

const RISK_RESULTS_PT: Record<RiskLevel, { label: string; color: string; bg: string; border: string; summary: string; tips: string[] }> = {
  low: { label: "Baixo Risco", color: "#1a6b3a", bg: "#f0faf3", border: "#2E6F40", summary: "Suas práticas de uso do WhatsApp são relativamente conscientes em relação à privacidade. Mesmo assim, até usuários de baixo risco compartilham número de telefone, contatos, IP e informações do dispositivo com a Meta.", tips: ["Confirme se o backup E2EE está ativado em Configurações → Conversas → Backup.", "Revise as sessões do WhatsApp Web em Configurações → Dispositivos Conectados.", "Verifique em quais grupos você está — mesmo a participação inativa expõe seu número."] },
  moderate: { label: "Risco Moderado", color: "#8a5a00", bg: "#fffbea", border: "#d4a017", summary: "Seus padrões de uso expõem você a coleta significativa de metadados. Um ou mais hábitos — mensagens para empresas, backup em nuvem ou tamanho dos grupos — ampliam a trilha de dados que a Meta pode construir sobre você.", tips: ["Ative o backup E2EE imediatamente em Configurações → Conversas → Backup.", "Ao enviar mensagens para empresas, presuma que a Meta pode ver essa conversa.", "Saia das sessões do WhatsApp Web quando não estiver usando ativamente."] },
  high: { label: "Alto Risco", color: "#8a2c00", bg: "#fff3ed", border: "#d45a17", summary: "Múltiplos hábitos de alto risco se combinam para criar uma exposição de privacidade substancial. Seus padrões de comunicação, comportamento financeiro e rede estão sendo amplamente perfilados.", tips: ["Ative o backup E2EE ou desative completamente o backup em nuvem.", "Saia de todas as sessões do WhatsApp Web permanentemente — use apenas o celular.", "Saia de grupos grandes cujos membros você não conhece pessoalmente.", "Considere separar transações financeiras da sua identidade no WhatsApp.", "Leia a seção Veredicto (§21) e a comparação Signal (§33)."] },
  critical: { label: "Risco Muito Alto", color: "#6e0000", bg: "#fdecec", border: "#c2453a", summary: "Seu uso atual do WhatsApp cria um dos perfis de dados mais abrangentes possíveis no ecossistema da Meta. Você está compartilhando padrões de comunicação, dados financeiros, impressão digital do dispositivo e participação em grupos a um nível que dá à Meta uma imagem excepcionalmente detalhada da sua vida.", tips: ["Desative o backup em nuvem completamente ou mude para backup E2EE com uma senha forte.", "Saia de todas as sessões vinculadas do WhatsApp Web e Desktop imediatamente.", "Saia de grupos com muitos membros que você não conhece pessoalmente.", "Pare de usar o WhatsApp Pay — use um app separado para transações financeiras.", "Leia §33 (Signal vs. WhatsApp) e considere migrar conversas de alta privacidade para o Signal.", "Leia §19 (excluir conta) antes de agir."] },
};

const RISK_RESULTS_ID: Record<RiskLevel, { label: string; color: string; bg: string; border: string; summary: string; tips: string[] }> = {
  low: { label: "Risiko Rendah", color: "#1a6b3a", bg: "#f0faf3", border: "#2E6F40", summary: "Kebiasaan penggunaan WhatsApp Anda relatif memperhatikan privasi. Namun, bahkan pengguna dengan risiko rendah tetap berbagi nomor telepon, kontak, IP, dan informasi perangkat dengan Meta.", tips: ["Konfirmasi bahwa backup E2EE diaktifkan di Pengaturan → Obrolan → Backup Obrolan.", "Tinjau sesi WhatsApp Web secara berkala di Pengaturan → Perangkat Tertaut.", "Tinjau grup yang Anda ikuti — keanggotaan saja sudah mengekspos nomor Anda."] },
  moderate: { label: "Risiko Sedang", color: "#8a5a00", bg: "#fffbea", border: "#d4a017", summary: "Pola penggunaan Anda memperlihatkan Anda pada pengumpulan metadata yang signifikan. Satu atau beberapa kebiasaan — pesan ke bisnis, backup cloud, atau ukuran grup — memperluas jejak data yang dapat dibangun Meta tentang Anda.", tips: ["Aktifkan backup E2EE segera di Pengaturan → Obrolan → Backup Obrolan.", "Saat mengirim pesan ke bisnis, asumsikan Meta dapat melihat percakapan tersebut.", "Logout dari sesi WhatsApp Web saat tidak digunakan."] },
  high: { label: "Risiko Tinggi", color: "#8a2c00", bg: "#fff3ed", border: "#d45a17", summary: "Beberapa kebiasaan berisiko tinggi bergabung menjadi paparan privasi yang signifikan. Pola komunikasi, perilaku keuangan, dan jaringan Anda sedang diprofilkan secara ekstensif.", tips: ["Aktifkan backup E2EE atau matikan backup cloud sepenuhnya.", "Logout dari semua sesi WhatsApp Web secara permanen — gunakan hanya ponsel.", "Keluar dari grup besar yang anggotanya tidak Anda kenal secara pribadi.", "Pertimbangkan memisahkan transaksi keuangan dari identitas WhatsApp Anda.", "Baca bagian Kesimpulan (§21) dan perbandingan Signal (§33)."] },
  critical: { label: "Risiko Sangat Tinggi", color: "#6e0000", bg: "#fdecec", border: "#c2453a", summary: "Penggunaan WhatsApp Anda saat ini menciptakan salah satu profil data paling komprehensif yang mungkin ada di ekosistem Meta. Anda berbagi pola komunikasi, data keuangan, sidik jari perangkat, dan keanggotaan grup pada tingkat yang memberi Meta gambaran yang sangat rinci tentang kehidupan Anda.", tips: ["Matikan backup cloud sepenuhnya, atau beralih ke backup E2EE dengan kata sandi yang kuat.", "Logout dari semua sesi WhatsApp Web dan Desktop yang tertaut segera.", "Keluar dari grup dengan banyak anggota yang tidak Anda kenal.", "Berhenti menggunakan WhatsApp Pay — gunakan aplikasi terpisah untuk transaksi keuangan.", "Baca §33 (Signal vs. WhatsApp) dan pertimbangkan untuk memigrasikan percakapan privasi tinggi ke Signal.", "Baca §19 (hapus akun) sebelum mengambil tindakan."] },
};

const RISK_RESULTS_ES: Record<RiskLevel, { label: string; color: string; bg: string; border: string; summary: string; tips: string[] }> = {
  low: { label: "Riesgo Bajo", color: "#1a6b3a", bg: "#f0faf3", border: "#2E6F40", summary: "Tus prácticas de uso de WhatsApp son relativamente conscientes en materia de privacidad. Aun así, incluso los usuarios de bajo riesgo comparten número de teléfono, contactos, IP e información del dispositivo con Meta.", tips: ["Confirma que el backup E2EE está activado en Ajustes → Chats → Copia de seguridad.", "Revisa periódicamente las sesiones de WhatsApp Web en Ajustes → Dispositivos vinculados.", "Revisa a qué grupos perteneces — incluso la membresía inactiva expone tu número."] },
  moderate: { label: "Riesgo Moderado", color: "#8a5a00", bg: "#fffbea", border: "#d4a017", summary: "Tus patrones de uso te exponen a una recopilación significativa de metadatos. Uno o varios hábitos — mensajería con empresas, backup en la nube o tamaño de grupos — amplían el rastro de datos que Meta puede construir sobre ti.", tips: ["Activa el backup E2EE inmediatamente en Ajustes → Chats → Copia de seguridad.", "Al escribir a empresas, asume que Meta puede ver esa conversación.", "Cierra sesión en WhatsApp Web cuando no lo estés usando activamente."] },
  high: { label: "Riesgo Alto", color: "#8a2c00", bg: "#fff3ed", border: "#d45a17", summary: "Múltiples hábitos de alto riesgo se combinan para crear una exposición sustancial de privacidad. Tus patrones de comunicación, comportamiento financiero y red están siendo perfilados extensamente.", tips: ["Activa el backup E2EE o desactiva completamente el backup en la nube.", "Cierra todas las sesiones de WhatsApp Web de forma permanente — usa solo el móvil.", "Sal de grupos grandes cuyos miembros no conozcas personalmente.", "Considera separar las transacciones financieras de tu identidad de WhatsApp.", "Lee la sección Veredicto (§21) y la comparación Signal (§33)."] },
  critical: { label: "Riesgo Muy Alto", color: "#6e0000", bg: "#fdecec", border: "#c2453a", summary: "Tu uso actual de WhatsApp crea uno de los perfiles de datos más completos posibles dentro del ecosistema Meta. Estás compartiendo patrones de comunicación, datos financieros, huella digital del dispositivo y membresía en grupos a un nivel que le da a Meta una imagen excepcionalmente detallada de tu vida.", tips: ["Desactiva completamente el backup en la nube, o cambia a backup E2EE con una contraseña segura.", "Cierra inmediatamente todas las sesiones vinculadas de WhatsApp Web y Desktop.", "Sal de grupos con muchos miembros que no conoces personalmente.", "Deja de usar WhatsApp Pay — usa una app separada para transacciones financieras.", "Lee §33 (Signal vs. WhatsApp) y considera migrar conversaciones de alta privacidad a Signal.", "Lee §19 (eliminar cuenta) antes de actuar."] },
};

const RISK_RESULTS_RU: Record<RiskLevel, { label: string; color: string; bg: string; border: string; summary: string; tips: string[] }> = {
  low: { label: "Низкий риск", color: "#1a6b3a", bg: "#f0faf3", border: "#2E6F40", summary: "Ваши практики использования WhatsApp относительно осознанны с точки зрения конфиденциальности. Тем не менее даже пользователи с низким риском делятся номером телефона, контактами, IP-адресом и данными устройства с Meta.", tips: ["Убедитесь, что резервное копирование E2EE включено: Настройки → Чаты → Резервное копирование.", "Периодически проверяйте сессии WhatsApp Web: Настройки → Связанные устройства.", "Проверьте, в каких группах вы состоите — даже неактивное участие раскрывает ваш номер."] },
  moderate: { label: "Умеренный риск", color: "#8a5a00", bg: "#fffbea", border: "#d4a017", summary: "Ваши привычки использования подвергают вас значительному сбору метаданных. Одна или несколько привычек — переписка с компаниями, облачное резервное копирование или размер групп — существенно расширяют след данных, который Meta может составить о вас.", tips: ["Немедленно включите резервное копирование E2EE: Настройки → Чаты → Резервное копирование.", "Переписываясь с компаниями, исходите из того, что Meta может видеть этот разговор.", "Выходите из сессий WhatsApp Web, когда не используете их активно."] },
  high: { label: "Высокий риск", color: "#8a2c00", bg: "#fff3ed", border: "#d45a17", summary: "Несколько привычек с высоким риском в совокупности создают существенную угрозу конфиденциальности. Ваши паттерны общения, финансовое поведение и сеть контактов активно профилируются.", tips: ["Включите резервное копирование E2EE или полностью отключите облачное резервное копирование.", "Навсегда выйдите из всех сессий WhatsApp Web — используйте только мобильное устройство.", "Выйдите из больших групп, участников которых вы не знаете лично.", "Рассмотрите возможность отделения финансовых операций от вашей идентичности в WhatsApp.", "Прочитайте раздел «Вывод» (§21) и сравнение Signal (§33)."] },
  critical: { label: "Очень высокий риск", color: "#6e0000", bg: "#fdecec", border: "#c2453a", summary: "Ваше текущее использование WhatsApp создаёт один из наиболее исчерпывающих профилей данных в экосистеме Meta. Вы делитесь паттернами общения, финансовыми данными, отпечатком устройства и членством в группах на уровне, который даёт Meta исключительно подробную картину вашей жизни.", tips: ["Полностью отключите облачное резервное копирование или перейдите на E2EE с надёжным паролем.", "Немедленно выйдите из всех связанных сессий WhatsApp Web и Desktop.", "Выйдите из групп с большим количеством незнакомых участников.", "Прекратите использовать WhatsApp Pay — используйте отдельное приложение для финансовых операций.", "Прочитайте §33 (Signal vs. WhatsApp) и всерьёз рассмотрите перенос важных переписок в Signal.", "Прочитайте §19 (удаление аккаунта) перед принятием каких-либо решений."] },
};

const RISK_RESULTS_DE: Record<RiskLevel, { label: string; color: string; bg: string; border: string; summary: string; tips: string[] }> = {
  low: { label: "Geringes Risiko", color: "#1a6b3a", bg: "#f0faf3", border: "#2E6F40", summary: "Ihre WhatsApp-Nutzungsgewohnheiten sind relativ datenschutzbewusst. Dennoch teilen auch Nutzer mit geringem Risiko Telefonnummer, Kontakte, IP-Adresse und Geräteinformationen mit Meta.", tips: ["Vergewissern Sie sich, dass das E2EE-Backup aktiviert ist: Einstellungen → Chats → Chat-Sicherung.", "Überprüfen Sie regelmäßig WhatsApp Web-Sitzungen unter Einstellungen → Verknüpfte Geräte.", "Prüfen Sie, in welchen Gruppen Sie Mitglied sind — selbst inaktive Mitgliedschaft gibt Ihre Nummer preis."] },
  moderate: { label: "Mittleres Risiko", color: "#8a5a00", bg: "#fffbea", border: "#d4a017", summary: "Ihre Nutzungsmuster setzen Sie einer erheblichen Metadatenerfassung aus. Eine oder mehrere Gewohnheiten — Unternehmenskommunikation, Cloud-Backup oder Gruppengröße — erweitern die Datenspur, die Meta über Sie aufbauen kann.", tips: ["Aktivieren Sie sofort das E2EE-Backup: Einstellungen → Chats → Chat-Sicherung.", "Wenn Sie Unternehmen anschreiben, gehen Sie davon aus, dass Meta das Gespräch sehen kann.", "Melden Sie sich von WhatsApp Web-Sitzungen ab, wenn Sie diese nicht aktiv nutzen."] },
  high: { label: "Hohes Risiko", color: "#8a2c00", bg: "#fff3ed", border: "#d45a17", summary: "Mehrere risikoreiche Gewohnheiten kombinieren sich zu einer erheblichen Datenschutzverletzung. Ihre Kommunikationsmuster, Ihr Finanzverhalten und Ihr Netzwerk werden umfangreich profiliert.", tips: ["Aktivieren Sie E2EE-Backup oder deaktivieren Sie das Cloud-Backup vollständig.", "Melden Sie sich dauerhaft von allen WhatsApp Web-Sitzungen ab — nutzen Sie nur das Mobilgerät.", "Verlassen Sie große Gruppen, deren Mitglieder Sie nicht persönlich kennen.", "Erwägen Sie, Finanztransaktionen von Ihrer WhatsApp-Identität zu trennen.", "Lesen Sie den Abschnitt Fazit (§21) und den Signal-Vergleich (§33)."] },
  critical: { label: "Sehr hohes Risiko", color: "#6e0000", bg: "#fdecec", border: "#c2453a", summary: "Ihre aktuelle WhatsApp-Nutzung erstellt eines der umfassendsten Datenprofile im Meta-Ökosystem. Sie teilen Kommunikationsmuster, Finanzdaten, Gerätefingerabdruck und Gruppenmitgliedschaft auf einem Niveau, das Meta ein außergewöhnlich detailliertes Bild Ihres Lebens gibt.", tips: ["Deaktivieren Sie das Cloud-Backup vollständig oder wechseln Sie zu E2EE mit einem sicheren Passwort.", "Melden Sie sich sofort von allen verknüpften WhatsApp Web- und Desktop-Sitzungen ab.", "Verlassen Sie Gruppen mit vielen Mitgliedern, die Sie nicht persönlich kennen.", "Hören Sie auf, WhatsApp Pay zu nutzen — verwenden Sie eine separate App für Finanztransaktionen.", "Lesen Sie §33 (Signal vs. WhatsApp) und erwägen Sie ernsthaft, datenschutzsensible Gespräche zu Signal zu migrieren.", "Lesen Sie §19 (Konto löschen) bevor Sie handeln."] },
};

const RISK_RESULTS_IT: Record<RiskLevel, { label: string; color: string; bg: string; border: string; summary: string; tips: string[] }> = {
  low: { label: "Rischio Basso", color: "#1a6b3a", bg: "#f0faf3", border: "#2E6F40", summary: "Le tue pratiche di utilizzo di WhatsApp sono relativamente attente alla privacy. Anche gli utenti a basso rischio condividono comunque il numero di telefono, i contatti, l'IP e le informazioni del dispositivo con Meta.", tips: ["Verifica che il backup E2EE sia attivo in Impostazioni → Chat → Backup chat.", "Controlla periodicamente le sessioni di WhatsApp Web in Impostazioni → Dispositivi collegati.", "Controlla i gruppi di cui fai parte — anche la semplice iscrizione espone il tuo numero."] },
  moderate: { label: "Rischio Moderato", color: "#8a5a00", bg: "#fffbea", border: "#d4a017", summary: "I tuoi schemi di utilizzo ti espongono a una raccolta significativa di metadati. Una o più abitudini — messaggi ad aziende, backup cloud o dimensione dei gruppi — ampliano la traccia di dati che Meta può costruire su di te.", tips: ["Attiva subito il backup E2EE in Impostazioni → Chat → Backup chat.", "Quando scrivi ad aziende, presumi che Meta possa vedere quella conversazione.", "Esci dalle sessioni di WhatsApp Web quando non le usi attivamente."] },
  high: { label: "Rischio Alto", color: "#8a2c00", bg: "#fff3ed", border: "#d45a17", summary: "Più abitudini ad alto rischio si combinano per creare una significativa esposizione della privacy. I tuoi schemi di comunicazione, il comportamento finanziario e la rete vengono ampiamente profilati.", tips: ["Attiva il backup E2EE o disattiva completamente il backup cloud.", "Esci definitivamente da tutte le sessioni di WhatsApp Web — usa solo il cellulare.", "Abbandona i gruppi grandi i cui membri non conosci personalmente.", "Considera di separare le transazioni finanziarie dalla tua identità WhatsApp.", "Leggi la sezione Verdetto (§21) e il confronto Signal (§33)."] },
  critical: { label: "Rischio Molto Alto", color: "#6e0000", bg: "#fdecec", border: "#c2453a", summary: "Il tuo utilizzo attuale di WhatsApp crea uno dei profili di dati più completi possibili nell'ecosistema Meta. Stai condividendo schemi di comunicazione, dati finanziari, impronta digitale del dispositivo e appartenenza a gruppi a un livello che offre a Meta un quadro eccezionalmente dettagliato della tua vita.", tips: ["Disattiva completamente il backup cloud, o passa a backup E2EE con una password sicura.", "Esci immediatamente da tutte le sessioni collegate di WhatsApp Web e Desktop.", "Lascia i gruppi con molti membri che non conosci personalmente.", "Smetti di usare WhatsApp Pay — usa un'app separata per le transazioni finanziarie.", "Leggi §33 (Signal vs. WhatsApp) e considera seriamente di migrare le conversazioni riservate su Signal.", "Leggi §19 (eliminare l'account) prima di agire."] },
};

const RISK_RESULTS_AR: Record<RiskLevel, { label: string; color: string; bg: string; border: string; summary: string; tips: string[] }> = {
  low: { label: "مخاطرة منخفضة", color: "#1a6b3a", bg: "#f0faf3", border: "#2E6F40", summary: "ممارساتك في استخدام واتساب تنمّ عن وعي نسبي بالخصوصية. ومع ذلك، حتى المستخدمون ذوو المخاطر المنخفضة يشاركون رقم الهاتف وجهات الاتصال وعنوان IP ومعلومات الجهاز مع ميتا.", tips: ["تأكد من تفعيل النسخ الاحتياطي المشفر E2EE في الإعدادات ← المحادثات ← النسخ الاحتياطي.", "راجع بانتظام جلسات واتساب ويب في الإعدادات ← الأجهزة المرتبطة.", "راجع المجموعات التي تنتمي إليها — حتى العضوية غير النشطة تكشف رقمك."] },
  moderate: { label: "مخاطرة متوسطة", color: "#8a5a00", bg: "#fffbea", border: "#d4a017", summary: "أنماط استخدامك تعرضك لجمع كبير للبيانات الوصفية. عادة أو أكثر — المراسلة مع الشركات، أو النسخ الاحتياطي السحابي، أو حجم المجموعات — تُوسّع أثر البيانات الذي يمكن لميتا بناؤه عنك.", tips: ["فعّل النسخ الاحتياطي E2EE فوراً في الإعدادات ← المحادثات ← النسخ الاحتياطي.", "عند مراسلة الشركات، افترض أن ميتا يمكنها رؤية تلك المحادثة.", "سجّل خروجك من جلسات واتساب ويب عندما لا تستخدمها بشكل نشط."] },
  high: { label: "مخاطرة عالية", color: "#8a2c00", bg: "#fff3ed", border: "#d45a17", summary: "عادات متعددة عالية الخطورة تجتمع لتخلق تعرضاً كبيراً للخصوصية. يجري تحليل أنماط تواصلك وسلوكك المالي وشبكتك على نطاق واسع.", tips: ["فعّل النسخ الاحتياطي E2EE أو أوقف النسخ الاحتياطي السحابي نهائياً.", "سجّل خروجك بشكل دائم من جميع جلسات واتساب ويب — استخدم الهاتف فقط.", "غادر المجموعات الكبيرة التي لا تعرف أعضاءها شخصياً.", "فكّر في فصل المعاملات المالية عن هويتك في واتساب.", "اقرأ قسم الحكم (§21) ومقارنة Signal (§33)."] },
  critical: { label: "مخاطرة عالية جداً", color: "#6e0000", bg: "#fdecec", border: "#c2453a", summary: "استخدامك الحالي لواتساب يخلق أحد أكثر ملفات البيانات شمولاً في منظومة ميتا. أنت تشارك أنماط التواصل والبيانات المالية وبصمة الجهاز والعضوية في المجموعات بمستوى يمنح ميتا صورة استثنائية التفصيل عن حياتك.", tips: ["أوقف النسخ الاحتياطي السحابي نهائياً، أو انتقل إلى النسخ الاحتياطي E2EE بكلمة مرور قوية.", "سجّل خروجك فوراً من جميع جلسات واتساب ويب وسطح المكتب المرتبطة.", "غادر المجموعات الكبيرة التي لا تعرف معظم أعضائها.", "توقف عن استخدام واتساب باي — استخدم تطبيقاً منفصلاً للمعاملات المالية.", "اقرأ §33 (Signal مقابل واتساب) وفكّر جدياً في نقل المحادثات الحساسة إلى Signal.", "اقرأ §19 (حذف الحساب) قبل اتخاذ أي إجراء."] },
};

const RISK_RESULTS_TR: Record<RiskLevel, { label: string; color: string; bg: string; border: string; summary: string; tips: string[] }> = {
  low: { label: "Düşük Risk", color: "#1a6b3a", bg: "#f0faf3", border: "#2E6F40", summary: "WhatsApp kullanım alışkanlıklarınız görece gizlilik bilinciyle şekilleniyor. Yine de düşük riskli kullanıcılar bile telefon numarası, kişiler, IP ve cihaz bilgilerini Meta ile paylaşıyor.", tips: ["E2EE yedeklemenin açık olduğunu doğrulayın: Ayarlar → Sohbetler → Sohbet Yedekleme.", "WhatsApp Web oturumlarını düzenli olarak kontrol edin: Ayarlar → Bağlı Cihazlar.", "Hangi gruplarda olduğunuzu gözden geçirin — pasif üyelik bile numaranızı ifşa eder."] },
  moderate: { label: "Orta Risk", color: "#8a5a00", bg: "#fffbea", border: "#d4a017", summary: "Kullanım alışkanlıklarınız sizi önemli bir meta veri toplamaya maruz bırakıyor. İşletmelere mesaj atmak, bulut yedekleme veya grup büyüklüğü gibi bir veya birkaç alışkanlık, Meta'nın sizin hakkınızda oluşturabileceği veri izini önemli ölçüde genişletiyor.", tips: ["E2EE yedeklemeyi hemen etkinleştirin: Ayarlar → Sohbetler → Sohbet Yedekleme.", "İşletmelere mesaj gönderirken Meta'nın o konuşmayı görebileceğini varsayın.", "WhatsApp Web oturumlarından aktif olarak kullanmadığınızda çıkış yapın."] },
  high: { label: "Yüksek Risk", color: "#8a2c00", bg: "#fff3ed", border: "#d45a17", summary: "Birden fazla yüksek riskli alışkanlık bir araya gelerek önemli bir gizlilik maruziyeti oluşturuyor. İletişim örüntüleriniz, finansal davranışlarınız ve ağınız kapsamlı biçimde profilleniyor.", tips: ["E2EE yedeklemeyi etkinleştirin ya da bulut yedeklemeyi tamamen devre dışı bırakın.", "Tüm WhatsApp Web oturumlarından kalıcı olarak çıkış yapın — yalnızca mobil cihaz kullanın.", "Üyelerini kişisel olarak tanımadığınız büyük gruplardan çıkın.", "Mali işlemleri WhatsApp kimliğinizden ayırmayı düşünün.", "Sonuç bölümünü (§21) ve Signal karşılaştırmasını (§33) okuyun."] },
  critical: { label: "Çok Yüksek Risk", color: "#6e0000", bg: "#fdecec", border: "#c2453a", summary: "Mevcut WhatsApp kullanımınız, Meta ekosisteminde mümkün olan en kapsamlı veri profillerinden birini oluşturuyor. İletişim örüntülerini, finansal verileri, cihaz parmak izini ve grup üyeliğini Meta'ya hayatınızın olağanüstü ayrıntılı bir resmini verecek düzeyde paylaşıyorsunuz.", tips: ["Bulut yedeklemeyi tamamen devre dışı bırakın ya da güçlü bir şifreyle E2EE yedeklemeye geçin.", "Bağlı tüm WhatsApp Web ve Masaüstü oturumlarından hemen çıkış yapın.", "Çoğu üyesini tanımadığınız büyük gruplardan ayrılın.", "WhatsApp Pay kullanmayı bırakın — finansal işlemler için ayrı bir uygulama kullanın.", "§33'ü (Signal vs. WhatsApp) okuyun ve yüksek gizlilik gerektiren konuşmaları Signal'e taşımayı ciddi biçimde değerlendirin.", "Herhangi bir adım atmadan önce §19'u (hesabı sil) okuyun."] },
};

const RISK_RESULTS_FR: Record<RiskLevel, { label: string; color: string; bg: string; border: string; summary: string; tips: string[] }> = {
  low: { label: "Risque Faible", color: "#1a6b3a", bg: "#f0faf3", border: "#2E6F40", summary: "Vos pratiques d'utilisation de WhatsApp sont relativement respectueuses de la vie privée. Même les utilisateurs à faible risque partagent néanmoins leur numéro de téléphone, leurs contacts, leur IP et les informations de leur appareil avec Meta.", tips: ["Vérifiez que la sauvegarde E2EE est activée dans Paramètres → Discussions → Sauvegarde des discussions.", "Consultez régulièrement les sessions WhatsApp Web dans Paramètres → Appareils connectés.", "Vérifiez les groupes dont vous êtes membre — même une adhésion inactive expose votre numéro."] },
  moderate: { label: "Risque Modéré", color: "#8a5a00", bg: "#fffbea", border: "#d4a017", summary: "Vos habitudes d'utilisation vous exposent à une collecte significative de métadonnées. Une ou plusieurs habitudes — messagerie avec des entreprises, sauvegarde cloud ou taille des groupes — élargissent la trace de données que Meta peut construire à votre sujet.", tips: ["Activez immédiatement la sauvegarde E2EE dans Paramètres → Discussions → Sauvegarde des discussions.", "Lorsque vous écrivez à des entreprises, considérez que Meta peut voir cette conversation.", "Déconnectez-vous des sessions WhatsApp Web lorsque vous ne les utilisez pas activement."] },
  high: { label: "Risque Élevé", color: "#8a2c00", bg: "#fff3ed", border: "#d45a17", summary: "Plusieurs habitudes à risque élevé se cumulent pour créer une exposition substantielle de la vie privée. Vos modes de communication, votre comportement financier et votre réseau font l'objet d'un profilage étendu.", tips: ["Activez la sauvegarde E2EE ou désactivez complètement la sauvegarde cloud.", "Déconnectez-vous définitivement de toutes les sessions WhatsApp Web — utilisez uniquement le mobile.", "Quittez les grands groupes dont vous ne connaissez pas personnellement les membres.", "Envisagez de séparer vos transactions financières de votre identité WhatsApp.", "Lisez la section Verdict (§21) et la comparaison Signal (§33)."] },
  critical: { label: "Risque Très Élevé", color: "#6e0000", bg: "#fdecec", border: "#c2453a", summary: "Votre utilisation actuelle de WhatsApp crée l'un des profils de données les plus complets possibles au sein de l'écosystème Meta. Vous partagez des modes de communication, des données financières, une empreinte numérique d'appareil et une appartenance à des groupes à un niveau qui donne à Meta une image exceptionnellement détaillée de votre vie.", tips: ["Désactivez complètement la sauvegarde cloud, ou passez à une sauvegarde E2EE avec un mot de passe fort.", "Déconnectez-vous immédiatement de toutes les sessions WhatsApp Web et Desktop liées.", "Quittez les groupes avec de nombreux membres que vous ne connaissez pas personnellement.", "Cessez d'utiliser WhatsApp Pay — utilisez une application séparée pour les transactions financières.", "Lisez §33 (Signal vs. WhatsApp) et envisagez sérieusement de migrer vos conversations sensibles vers Signal.", "Lisez §19 (supprimer le compte) avant d'agir."] },
};

const RISK_RESULTS_UR: Record<RiskLevel, { label: string; color: string; bg: string; border: string; summary: string; tips: string[] }> = {
  low: { label: "کم خطرہ", color: "#1a6b3a", bg: "#f0faf3", border: "#2E6F40", summary: "واٹس ایپ استعمال کرنے کے آپ کے طریقے نسبتاً پرائیویسی کے حوالے سے باشعور ہیں۔ پھر بھی، کم خطرے کے صارفین بھی فون نمبر، رابطے، IP اور ڈیوائس کی معلومات میٹا کے ساتھ شیئر کرتے ہیں۔", tips: ["E2EE بیک اپ کے فعال ہونے کی تصدیق کریں: ترتیبات ← چیٹس ← چیٹ بیک اپ۔", "واٹس ایپ ویب سیشنز کا باقاعدگی سے جائزہ لیں: ترتیبات ← لنک کردہ ڈیوائسز۔", "جائزہ لیں کہ آپ کن گروپس میں ہیں — غیر فعال رکنیت بھی آپ کا نمبر ظاہر کرتی ہے۔"] },
  moderate: { label: "اعتدال پسند خطرہ", color: "#8a5a00", bg: "#fffbea", border: "#d4a017", summary: "آپ کے استعمال کے طریقے آپ کو خاصے میٹا ڈیٹا جمع کرنے کا نشانہ بناتے ہیں۔ ایک یا زیادہ عادات — کاروباروں سے میسجنگ، کلاؤڈ بیک اپ، یا گروپ کا حجم — میٹا کے آپ کے بارے میں ڈیٹا ٹریل کو نمایاں طور پر بڑھاتی ہیں۔", tips: ["فوری طور پر E2EE بیک اپ فعال کریں: ترتیبات ← چیٹس ← چیٹ بیک اپ۔", "جب کاروباروں کو میسج کریں، یہ سمجھیں کہ میٹا وہ گفتگو دیکھ سکتی ہے۔", "واٹس ایپ ویب سیشنز سے لاگ آؤٹ کریں جب فعال استعمال میں نہ ہوں۔"] },
  high: { label: "زیادہ خطرہ", color: "#8a2c00", bg: "#fff3ed", border: "#d45a17", summary: "متعدد زیادہ خطرے والی عادات مل کر ایک اہم پرائیویسی نمائش بناتی ہیں۔ آپ کے رابطے کے طریقے، مالی رویہ اور نیٹ ورک کا وسیع پیمانے پر پروفائل بنایا جا رہا ہے۔", tips: ["E2EE بیک اپ فعال کریں یا کلاؤڈ بیک اپ مکمل طور پر بند کریں۔", "تمام واٹس ایپ ویب سیشنز سے مستقل لاگ آؤٹ کریں — صرف موبائل استعمال کریں۔", "بڑے گروپس چھوڑیں جن کے اراکین کو آپ ذاتی طور پر نہیں جانتے۔", "مالی لین دین کو واٹس ایپ شناخت سے الگ کرنے پر غور کریں۔", "§21 (نتیجہ) اور §33 (Signal بمقابلہ واٹس ایپ) پڑھیں۔"] },
  critical: { label: "بہت زیادہ خطرہ", color: "#6e0000", bg: "#fdecec", border: "#c2453a", summary: "واٹس ایپ کا آپ کا موجودہ استعمال میٹا ایکوسسٹم میں سب سے جامع ڈیٹا پروفائلز میں سے ایک بناتا ہے۔ آپ رابطے کے طریقے، مالی ڈیٹا، ڈیوائس فنگرپرنٹنگ اور گروپ رکنیت اس سطح پر شیئر کر رہے ہیں جو میٹا کو آپ کی زندگی کی غیر معمولی تفصیلی تصویر دیتی ہے۔", tips: ["کلاؤڈ بیک اپ مکمل طور پر بند کریں، یا مضبوط پاسورڈ کے ساتھ E2EE بیک اپ پر سوئچ کریں۔", "تمام لنک کردہ واٹس ایپ ویب اور ڈیسک ٹاپ سیشنز سے فوری لاگ آؤٹ کریں۔", "زیادہ رکنیت والے گروپس چھوڑیں جن کے اکثر اراکین آپ کی جان پہچان کے نہیں۔", "واٹس ایپ پے استعمال کرنا بند کریں — مالی لین دین کے لیے الگ ایپ استعمال کریں۔", "§33 (Signal بمقابلہ واٹس ایپ) پڑھیں اور اعلی پرائیویسی گفتگو کو Signal پر منتقل کرنے پر سنجیدگی سے غور کریں۔", "کوئی قدم اٹھانے سے پہلے §19 (اکاؤنٹ ڈیلیٹ) پڑھیں۔"] },
};

type Lang = "en" | "hi" | "pt" | "id" | "es" | "ru" | "de" | "it" | "ar" | "tr" | "fr" | "ur";

const RISK_QUESTIONS_MAP: Record<Lang, RiskQuestion[]> = {
  en: RISK_QUESTIONS_EN, hi: RISK_QUESTIONS_HI, pt: RISK_QUESTIONS_PT, id: RISK_QUESTIONS_ID,
  es: RISK_QUESTIONS_ES, ru: RISK_QUESTIONS_RU, de: RISK_QUESTIONS_DE, it: RISK_QUESTIONS_IT,
  ar: RISK_QUESTIONS_AR, tr: RISK_QUESTIONS_TR, fr: RISK_QUESTIONS_FR, ur: RISK_QUESTIONS_UR,
};

const RISK_RESULTS_MAP: Record<Lang, Record<RiskLevel, { label: string; color: string; bg: string; border: string; summary: string; tips: string[] }>> = {
  en: RISK_RESULTS_EN, hi: RISK_RESULTS_HI, pt: RISK_RESULTS_PT, id: RISK_RESULTS_ID,
  es: RISK_RESULTS_ES, ru: RISK_RESULTS_RU, de: RISK_RESULTS_DE, it: RISK_RESULTS_IT,
  ar: RISK_RESULTS_AR, tr: RISK_RESULTS_TR, fr: RISK_RESULTS_FR, ur: RISK_RESULTS_UR,
};

const CALC_UI: Record<Lang, { title: string; subtitle: string; btn: string; retake: string; scoreLabel: string; outOf: string }> = {
  en: { title: "Your Personal WhatsApp Privacy Risk Score", subtitle: "5 quick questions — get a personalised privacy assessment", btn: "See my score", retake: "Retake quiz", scoreLabel: "Your score", outOf: "out of 15" },
  hi: { title: "आपका व्यक्तिगत WhatsApp प्राइवेसी जोखिम स्कोर", subtitle: "5 त्वरित प्रश्न — व्यक्तिगत प्राइवेसी मूल्यांकन पाएँ", btn: "मेरा स्कोर देखें", retake: "फिर से लें", scoreLabel: "आपका स्कोर", outOf: "15 में से" },
  pt: { title: "Sua Pontuação Pessoal de Risco de Privacidade no WhatsApp", subtitle: "5 perguntas rápidas — obtenha uma avaliação de privacidade personalizada", btn: "Ver minha pontuação", retake: "Refazer o teste", scoreLabel: "Sua pontuação", outOf: "de 15" },
  id: { title: "Skor Risiko Privasi WhatsApp Pribadi Anda", subtitle: "5 pertanyaan singkat — dapatkan penilaian privasi personal", btn: "Lihat skor saya", retake: "Ulangi kuis", scoreLabel: "Skor Anda", outOf: "dari 15" },
  es: { title: "Tu Puntuación Personal de Riesgo de Privacidad en WhatsApp", subtitle: "5 preguntas rápidas — obtén una evaluación personalizada de privacidad", btn: "Ver mi puntuación", retake: "Repetir el cuestionario", scoreLabel: "Tu puntuación", outOf: "de 15" },
  ru: { title: "Ваш личный рейтинг риска конфиденциальности в WhatsApp", subtitle: "5 быстрых вопросов — получите персонализированную оценку", btn: "Посмотреть мой результат", retake: "Пройти снова", scoreLabel: "Ваш результат", outOf: "из 15" },
  de: { title: "Ihr persönlicher WhatsApp-Datenschutzrisiko-Score", subtitle: "5 kurze Fragen — erhalten Sie eine persönliche Datenschutzbewertung", btn: "Mein Ergebnis anzeigen", retake: "Quiz wiederholen", scoreLabel: "Ihr Ergebnis", outOf: "von 15" },
  it: { title: "Il Tuo Punteggio Personale di Rischio Privacy su WhatsApp", subtitle: "5 domande rapide — ottieni una valutazione personalizzata della privacy", btn: "Vedi il mio punteggio", retake: "Rifare il quiz", scoreLabel: "Il tuo punteggio", outOf: "su 15" },
  ar: { title: "درجة مخاطر الخصوصية الشخصية على واتساب", subtitle: "5 أسئلة سريعة — احصل على تقييم خصوصية مخصص", btn: "اعرض درجتي", retake: "إعادة الاختبار", scoreLabel: "درجتك", outOf: "من 15" },
  tr: { title: "Kişisel WhatsApp Gizlilik Risk Puanınız", subtitle: "5 hızlı soru — kişiselleştirilmiş bir gizlilik değerlendirmesi alın", btn: "Puanımı gör", retake: "Testi tekrar al", scoreLabel: "Puanınız", outOf: "15 üzerinden" },
  fr: { title: "Votre Score Personnel de Risque de Confidentialité sur WhatsApp", subtitle: "5 questions rapides — obtenez une évaluation personnalisée de votre vie privée", btn: "Voir mon score", retake: "Recommencer le quiz", scoreLabel: "Votre score", outOf: "sur 15" },
  ur: { title: "واٹس ایپ پر آپ کا ذاتی پرائیویسی رسک اسکور", subtitle: "5 فوری سوالات — ذاتی پرائیویسی جائزہ حاصل کریں", btn: "میرا اسکور دیکھیں", retake: "دوبارہ لیں", scoreLabel: "آپ کا اسکور", outOf: "15 میں سے" },
};

const TIPS_HEADING: Record<Lang, string> = {
  en: "Immediate steps for you", hi: "आपके लिए तुरंत कदम", pt: "Passos imediatos para você",
  id: "Langkah segera untuk Anda", es: "Pasos inmediatos para ti", ru: "Немедленные шаги для вас",
  de: "Sofortige Schritte für Sie", it: "Passi immediati per te", ar: "خطوات فورية لك",
  tr: "Sizin için anında adımlar", fr: "Étapes immédiates pour vous", ur: "آپ کے لیے فوری اقدامات",
};

const DISCLAIMER_TEXT: Record<Lang, string> = {
  en: "This calculator is a simplified risk estimate based on your self-reported usage. The actual data Meta collects is broader than any quiz can capture — see the sources in this article for the full picture.",
  hi: "यह calculator आपके द्वारा दिए गए उत्तरों के आधार पर एक सरलीकृत जोखिम अनुमान है। Meta द्वारा एकत्र किया गया वास्तविक डेटा इस लेख में detailed sources के अनुसार अधिक हो सकता है।",
  pt: "Esta calculadora é uma estimativa simplificada de risco com base no seu uso autodeclarado. Os dados reais coletados pela Meta são mais amplos do que qualquer questionário pode capturar.",
  id: "Kalkulator ini adalah perkiraan risiko yang disederhanakan berdasarkan penggunaan yang Anda laporkan sendiri. Data aktual yang dikumpulkan Meta lebih luas dari yang bisa ditangkap kuis mana pun.",
  es: "Esta calculadora es una estimación simplificada del riesgo basada en tu uso declarado. Los datos reales que recopila Meta son más amplios de lo que cualquier cuestionario puede capturar.",
  ru: "Этот калькулятор — упрощённая оценка риска, основанная на ваших самостоятельно сообщённых данных. Фактические данные, которые собирает Meta, шире, чем может охватить любая анкета.",
  de: "Dieser Rechner ist eine vereinfachte Risikoschätzung basierend auf Ihren selbst gemachten Angaben. Die tatsächlichen Daten, die Meta sammelt, sind umfangreicher, als ein Quiz erfassen kann.",
  it: "Questa calcolatrice è una stima semplificata del rischio basata sull'utilizzo da te dichiarato. I dati effettivi raccolti da Meta sono più ampi di quanto qualsiasi quiz possa catturare.",
  ar: "هذه الحاسبة هي تقدير مبسّط للمخاطر بناءً على استخدامك المُبلَّغ عنه ذاتياً. البيانات الفعلية التي تجمعها ميتا أوسع مما يمكن لأي اختبار رصده.",
  tr: "Bu hesap makinesi, kendi bildirdiğiniz kullanıma dayalı basitleştirilmiş bir risk tahminidir. Meta'nın topladığı gerçek veriler herhangi bir testin yakalayabileceğinden daha geniştir.",
  fr: "Cette calculatrice est une estimation simplifiée du risque basée sur votre utilisation déclarée. Les données réelles collectées par Meta sont plus larges que ce qu'un questionnaire peut capturer.",
  ur: "یہ کیلکولیٹر آپ کی خود بتائی گئی استعمال کی عادات پر مبنی ایک سادہ خطرے کا تخمینہ ہے۔ میٹا اصل میں جتنا ڈیٹا جمع کرتی ہے وہ کسی بھی کوئز سے زیادہ وسیع ہے۔",
};

const INTERACTIVE_LABEL: Record<Lang, string> = {
  en: "Interactive Tool", hi: "इंटरैक्टिव टूल", pt: "Ferramenta Interativa",
  id: "Alat Interaktif", es: "Herramienta Interactiva", ru: "Интерактивный инструмент",
  de: "Interaktives Tool", it: "Strumento Interattivo", ar: "أداة تفاعلية",
  tr: "Etkileşimli Araç", fr: "Outil Interactif", ur: "انٹرایکٹو ٹول",
};

const ANSWERED_TEMPLATE: Record<Lang, (a: number, t: number) => string> = {
  en: (a, t) => `${a} / ${t} questions answered`,
  hi: (a, t) => `${a} / ${t} सवालों के जवाब दिए`,
  pt: (a, t) => `${a} / ${t} perguntas respondidas`,
  id: (a, t) => `${a} / ${t} pertanyaan dijawab`,
  es: (a, t) => `${a} / ${t} preguntas respondidas`,
  ru: (a, t) => `${a} / ${t} вопросов отвечено`,
  de: (a, t) => `${a} / ${t} Fragen beantwortet`,
  it: (a, t) => `${a} / ${t} domande risposte`,
  ar: (a, t) => `${a} / ${t} أسئلة تمت الإجابة عليها`,
  tr: (a, t) => `${a} / ${t} soru yanıtlandı`,
  fr: (a, t) => `${a} / ${t} questions répondues`,
  ur: (a, t) => `${a} / ${t} سوالات کے جوابات دیے`,
};

function PrivacyRiskCalculator({ lang }: { lang: Lang }) {
  const questions = RISK_QUESTIONS_MAP[lang] ?? RISK_QUESTIONS_EN;
  const results = RISK_RESULTS_MAP[lang] ?? RISK_RESULTS_EN;
  const ui = CALC_UI[lang] ?? CALC_UI.en;

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);
  const totalScore = Object.values(answers).reduce((s, v) => s + v, 0);
  const riskLevel = getRiskLevel(totalScore);
  const result = results[riskLevel];

  const maxScore = questions.length * 3;

  const headingText = ui.title;
  const subText = ui.subtitle;
  const submitText = ui.btn;
  const retakeText = ui.retake;
  const yourScoreText = ui.scoreLabel;
  const tipsHeading = TIPS_HEADING[lang] ?? TIPS_HEADING.en;
  const disclaimerText = DISCLAIMER_TEXT[lang] ?? DISCLAIMER_TEXT.en;

  return (
    <section
      id="risk-calc"
      className="scroll-mt-24 my-10 rounded-2xl border overflow-hidden"
      style={{ borderColor: "#2E6F40" + "40", backgroundColor: "rgba(255,255,255,0.7)" }}
    >
      <div className="px-5 sm:px-7 py-5 border-b" style={{ borderColor: "#2E6F40" + "25", backgroundColor: "#f0faf3" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl" aria-hidden>🔒</span>
          <span className="text-xs uppercase tracking-wider font-semibold text-[#2E6F40]">
            {INTERACTIVE_LABEL[lang] ?? INTERACTIVE_LABEL.en}
          </span>
        </div>
        <h2 className="text-[22px] sm:text-[26px] font-semibold text-[#0F2A18] leading-tight">{headingText}</h2>
        <p className="mt-2 text-[15.5px] text-[#2a3d2f] leading-[1.65]">{subText}</p>
      </div>

      <div className="px-5 sm:px-7 py-6">
        {!submitted ? (
          <>
            <div className="space-y-7">
              {questions.map((q, qi) => (
                <div key={q.id}>
                  <p className="text-[16px] font-semibold text-[#0F2A18] mb-3 leading-snug">
                    <span className="inline-block mr-2 w-6 h-6 rounded-full text-white text-[13px] font-bold text-center leading-6 shrink-0"
                      style={{ backgroundColor: "#2E6F40" }}>
                      {qi + 1}
                    </span>
                    {q.question}
                  </p>
                  <div className="space-y-2 pl-8">
                    {q.options.map((opt) => {
                      const selected = answers[q.id] === opt.score;
                      return (
                        <label
                          key={opt.label}
                          className="flex items-start gap-3 cursor-pointer group"
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={opt.score}
                            checked={selected}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.score }))}
                            className="mt-1 accent-[#2E6F40] shrink-0"
                          />
                          <span
                            className="text-[15.5px] leading-snug text-[#1f2a24] group-hover:text-[#2E6F40] transition-colors"
                            style={selected ? { color: "#2E6F40", fontWeight: 500 } : {}}
                          >
                            {opt.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <div className="mb-3 text-[14px] text-[#4a5a4f]">
                {(ANSWERED_TEMPLATE[lang] ?? ANSWERED_TEMPLATE.en)(Object.keys(answers).length, questions.length)}
              </div>
              <button
                onClick={() => { if (allAnswered) setSubmitted(true); }}
                disabled={!allAnswered}
                className="px-6 py-3 rounded-full font-semibold text-white text-[15.5px] transition-all"
                style={{
                  backgroundColor: allAnswered ? "#2E6F40" : "#9ab8a4",
                  cursor: allAnswered ? "pointer" : "not-allowed",
                }}
              >
                {submitText}
              </button>
            </div>
          </>
        ) : (
          <div>
            <div
              className="rounded-xl px-5 py-5 mb-6 border"
              style={{ backgroundColor: result.bg, borderColor: result.border + "55" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <div className="text-[13px] uppercase tracking-wider font-semibold mb-1" style={{ color: result.color }}>
                    {yourScoreText}
                  </div>
                  <div className="text-[40px] font-bold leading-none" style={{ color: result.color }}>
                    {totalScore} <span className="text-[20px] font-normal text-[#4a5a4f]">/ {maxScore}</span>
                  </div>
                </div>
                <div
                  className="px-4 py-2 rounded-full font-bold text-white text-[15px]"
                  style={{ backgroundColor: result.color }}
                >
                  {result.label}
                </div>
              </div>

              <div className="w-full h-3 rounded-full bg-white/60 overflow-hidden mb-4">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(totalScore / maxScore) * 100}%`,
                    backgroundColor: result.color,
                  }}
                />
              </div>

              <p className="text-[15.5px] leading-[1.7] text-[#1f2a24]">{result.summary}</p>
            </div>

            {result.tips.length > 0 && (
              <div className="mb-6">
                <h3 className="text-[17px] font-semibold text-[#0F2A18] mb-3">{tipsHeading}</h3>
                <ul className="space-y-2">
                  {result.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-[15.5px] leading-[1.65] text-[#1f2a24]">
                      <span className="mt-0.5 shrink-0 text-[#2E6F40] font-bold">→</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-[13px] text-[#4a5a4f] italic mb-5 leading-[1.6]">{disclaimerText}</div>

            <button
              onClick={() => { setAnswers({}); setSubmitted(false); }}
              className="px-5 py-2.5 rounded-full text-[14.5px] font-medium border text-[#0F2A18] hover:bg-[#0F2A18]/5 transition-colors"
              style={{ borderColor: "#0F2A18" + "25" }}
            >
              {retakeText}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────────── ENGLISH ARTICLE ───────────────────────────── */

function ArticleEnglish() {
  return (
    <>
      <PrivacyRiskCalculator lang="en" />
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

      {/* 22. MYANMAR */}
      <H2 id="myanmar">22. WhatsApp &amp; the Rohingya Genocide</H2>
      <P>
        The gravest real-world consequence of WhatsApp's spread across the
        developing world is not a regulatory fine or a spyware lawsuit. It is a
        genocide. Between August and September 2017, the Myanmar military
        launched a campaign of ethnic cleansing against the Rohingya Muslim
        minority that the UN described as "a textbook example of ethnic
        cleansing" and later, in its 2018 Fact-Finding Mission report, as
        bearing "the hallmarks of genocide."<S ids={[98]} />
      </P>
      <P>
        Facebook — and through the same platform infrastructure, WhatsApp —
        became the primary vector through which anti-Rohingya hate speech,
        dehumanising imagery, and explicit calls for violence spread through
        Myanmar society during the years leading up to and during the
        atrocities.<S ids={[99, 100]} /> In November 2018, Facebook's own
        internal team acknowledged to the BBC that the platform had been used
        to "incite offline violence."<S ids={[100]} /> The New York Times, in a
        deeply reported October 2018 investigation, documented how military
        officers and their proxies used Facebook groups and messages — including
        via WhatsApp — to post hoaxes, fabricated quotes from Buddhist monks,
        and coordinated harassment campaigns against journalists who tried to
        report the truth.<S ids={[99]} />
      </P>
      <H3>22.1 The UN's direct conclusion</H3>
      <P>
        The UN Fact-Finding Mission's September 2018 report is unambiguous on
        the role of social media. It states: <em>"Social media — Facebook in
        particular — has been a useful instrument for those seeking to spread
        hate speech, and this has at times resulted in real-world
        violence."</em> The mission called on Myanmar's military commanders to
        be investigated and prosecuted for genocide, crimes against humanity,
        and war crimes, and named Facebook's role in the information environment
        directly.<S ids={[98]} />
      </P>
      <H3>22.2 The $150 billion lawsuit</H3>
      <P>
        In December 2021, Rohingya refugee groups filed a lawsuit in California
        against Meta, seeking <strong>US $150 billion</strong> in damages. The
        claim alleges that Meta's algorithms and the reach of its platforms —
        including Facebook's WhatsApp-linked infrastructure — amplified and
        recommended hate content, and that Meta ignored repeated warnings from
        researchers, journalists, and civil society going back to 2013 about
        anti-Rohingya content on its platforms.<S ids={[101]} />
      </P>
      <Callout tone="danger" title="Why this matters for WhatsApp specifically">
        WhatsApp's role in Myanmar is a specific, documented case study in what
        happens when an end-to-end encrypted messaging network with
        frictionless group-forwarding is deployed into a society with low media
        literacy, inadequate content moderation in local languages, and a
        military actively seeking to weaponise information. The encryption
        WhatsApp uses to protect dissidents in democracies was the same
        technology that blinded moderators to coordinated hate campaigns in
        Myanmar. The architecture cannot be both — it is one or the
        other.<S ids={[98, 99, 100, 101]} />
      </Callout>

      {/* 23. BRAZIL 2018 */}
      <H2 id="brazil2018">23. Brazil 2018: WhatsApp as a "Disinformation Machine"</H2>
      <P>
        The 2018 Brazilian presidential election produced the first major
        documented case study of a WhatsApp-native disinformation operation
        determining the outcome of a democratic election. Jair Bolsonaro won
        the presidency on 28 October 2018. Researchers at the University of São
        Paulo, later corroborated by Oxford Internet Institute and MIT
        Technology Review, documented a systematic, well-funded operation in
        which WhatsApp groups — rather than Facebook timelines — served as the
        primary distribution channel for fabricated news,
        out-of-context images, and manipulated videos.<S ids={[102, 103, 104]} />
      </P>
      <H3>23.1 The corporate bulk-messaging operation</H3>
      <P>
        The Guardian and Brazilian media reported that business supporters of
        Bolsonaro had collectively paid for bulk WhatsApp messaging services
        that seeded thousands of curated WhatsApp groups with pre-fabricated
        disinformation packages — a violation of WhatsApp's own terms of
        service, which prohibit bulk and automated messaging, but one that
        WhatsApp's architecture made extremely difficult to detect or
        enforce.<S ids={[102, 103]} /> Brazilian election prosecutors called it
        a <em>"disinformation ecosystem."</em>
      </P>
      <H3>23.2 The structural problem</H3>
      <P>
        What made WhatsApp uniquely dangerous as an election-influence surface
        is the same property that makes it attractive as a communications tool:
        private, encrypted group messages that spread at the speed of a social
        network but are invisible to fact-checkers, journalists, election
        monitors, and the platform's own trust-and-safety teams.<S ids={[103, 104]} /> A false story on Twitter can
        be spotted by a journalist and debunked within hours. The identical story
        forwarded inside 10,000 private WhatsApp groups reaches tens of millions
        of people with zero public accountability.<S ids={[104]} />
      </P>
      <P>
        MIT Technology Review's October 2019 analysis documented how a single
        piece of misinformation — a fabricated document purportedly showing
        Bolsonaro's opponent Fernando Haddad had a "gay kit" for schoolchildren
        — was forwarded through WhatsApp groups at a scale researchers estimated
        reached more than 12 million people in the final weeks of the
        campaign.<S ids={[104]} /> WhatsApp's forwarding limits, imposed after
        the Indian lynching crisis, came too late and with too little friction
        to stop the operation.<S ids={[69, 102]} />
      </P>
      <Callout tone="warn" title="Pattern repeated in 2019 Indian elections">
        The same WhatsApp-group disinformation playbook documented in Brazil
        2018 was reported in detail during India's 2019 general election, which
        the BJP and Congress both used WhatsApp broadcast lists and groups to
        circulate campaign material — some of it fabricated — to hundreds of
        millions of users. WhatsApp's private architecture again prevented any
        independent audit of what was being distributed.<S ids={[67, 68, 71]} />
      </Callout>

      {/* 24. WHATSAPP PAY */}
      <H2 id="whatsapppay">24. WhatsApp Pay — Your Financial Data</H2>
      <P>
        WhatsApp Pay launched in Brazil in 2020 and in India in late 2020 after
        a two-year regulatory approval process with India's National Payments
        Corporation of India (NPCI). By 2024, WhatsApp Pay in India had
        approval to onboard up to 100 million users. The service allows
        peer-to-peer UPI payments directly within WhatsApp chats.<S ids={[140, 141]} />
      </P>
      <H3>24.1 What financial data WhatsApp collects</H3>
      <P>
        WhatsApp's Privacy Policy explicitly includes <em>"payment or financial
        information"</em> within the data it collects.<S ids={[1]} /> When you
        use WhatsApp Pay, the following additional categories of data are
        generated and collected:
      </P>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>Payment transaction amounts, dates, and merchant/recipient identifiers.<S ids={[1, 140]} /></li>
        <li>Bank account or UPI ID linked to the payment.<S ids={[140, 141]} /></li>
        <li>Transaction history and patterns — who you pay, how much, how often.<S ids={[1, 140]} /></li>
        <li>Device and IP address at the time of payment.<S ids={[1, 2]} /></li>
        <li>KYC (Know Your Customer) information where required by local regulation.<S ids={[141]} /></li>
      </ul>
      <H3>24.2 What Meta can infer from payment data</H3>
      <P>
        Payment data is among the most intimate data a corporation can hold.
        Combined with the metadata stack WhatsApp already has — your social
        graph, your device, your location, your communication patterns — your
        transaction history allows Meta to infer your income bracket, your
        consumption habits, your political donations, your religious giving,
        your medical spending, and your relationship network in ways that pure
        messaging metadata cannot.<S ids={[130, 134]} /> Privacy researchers at
        Privacy International have warned specifically about the aggregation
        risk when payments data sits inside a Meta-owned platform alongside one
        of the largest social graphs in human history.<S ids={[140]} />
      </P>
      <Callout tone="danger" title="Payment data is permanently harder to anonymise">
        Unlike messaging metadata, financial transaction records have regulatory
        retention requirements in most countries — meaning WhatsApp/Meta may be
        legally <em>required</em> to store your payment history for years, even
        if you delete your WhatsApp account. The "delete account" deletion
        timeline described in §19 does not apply to regulatory-mandated payment
        records.<S ids={[2, 140, 141]} />
      </Callout>

      {/* 25. CVEs */}
      <H2 id="cves">25. A Catalogue of Critical Security Vulnerabilities</H2>
      <P>
        WhatsApp has a public security advisory programme and has disclosed a
        significant number of serious, remotely exploitable vulnerabilities over
        its history. The following is not a complete list — it is a selection of
        the most consequential publicly documented cases.<S ids={[136]} />
      </P>
      <H3>25.1 CVE-2019-3568 — The Pegasus zero-click (May 2019)</H3>
      <P>
        The most consequential WhatsApp vulnerability in public record. A
        buffer overflow in WhatsApp's VOIP stack allowed attackers to execute
        arbitrary code by sending a crafted SRTP packet — without any user
        interaction, without the call being answered, and without leaving a
        trace in the call log.<S ids={[105]} /> CVSS score: <strong>9.8
        (Critical)</strong>. This vulnerability was weaponised at scale by NSO
        Group's Pegasus, targeting more than 1,400 users across roughly 20
        countries — journalists, human rights defenders, lawyers, and
        politicians.<S ids={[19, 21, 105]} />
      </P>
      <H3>25.2 CVE-2022-36934 — Integer overflow RCE (September 2022)</H3>
      <P>
        A critical integer overflow vulnerability in WhatsApp for Android and
        iOS that could allow remote code execution within the context of an
        established video call, without requiring any user interaction beyond
        receiving the call.<S ids={[106]} /> CVSS score: <strong>9.8
        (Critical)</strong>. WhatsApp patched this in versions released in
        September 2022.
      </P>
      <H3>25.3 CVE-2022-27492 — Integer underflow in video parsing (September 2022)</H3>
      <P>
        A related integer underflow flaw in WhatsApp's video file parsing logic
        allowed maliciously crafted video files to trigger code execution when
        received as a message attachment — a <em>one-click</em> exploit
        requiring only that the recipient open or preview the
        attachment.<S ids={[107]} /> CVSS score: <strong>7.8 (High)</strong>.
      </P>
      <H3>25.4 CVE-2021-24027 — Cache configuration bypass (April 2021)</H3>
      <P>
        A cache configuration issue on WhatsApp for Android that could allow
        MITM attackers to access previously sent attachments due to incorrect
        storage of certain media files in a path accessible to other
        applications with storage permission.<S ids={[108]} /> This affected
        WhatsApp versions prior to 2.21.4.18.
      </P>
      <H3>25.5 WhatsApp Desktop — code execution via malicious links (2020)</H3>
      <P>
        Check Point Research disclosed in February 2020 that WhatsApp Desktop
        (the Electron-based app) was vulnerable to a cross-site scripting (XSS)
        attack delivered via a crafted message link, which could then be used to
        execute Python or PHP code on the victim's machine depending on the
        software installed.<S ids={[109]} /> Check Point had previously
        disclosed a related vulnerability in 2019 that allowed modification of
        quoted messages and the impersonation of senders — enabling
        disinformation to be inserted retroactively into private group
        conversations.<S ids={[110]} />
      </P>
      <Callout tone="warn" title="The vulnerability disclosure pattern">
        WhatsApp has been responsible in patching publicly disclosed
        vulnerabilities — the issue is not negligence in fixing known bugs. The
        issue is that a 3-billion-user platform with the level of privileged
        access that WhatsApp has (contacts, microphone, camera, location,
        storage) is an enormously attractive target, and its closed-source
        codebase means that independent security researchers cannot proactively
        audit what WhatsApp hasn't already disclosed.<S ids={[118, 136]} />
      </Callout>

      {/* 26. WEB DESKTOP */}
      <H2 id="webdesktop">26. WhatsApp Web &amp; Desktop: The Expanded Attack Surface</H2>
      <P>
        WhatsApp Web and the Desktop application extend WhatsApp's reach beyond
        the phone, linking a browser session or Electron app to the phone's
        account via a QR code or 14-digit link code. While convenient, this
        creates an additional attack surface that has been exploited
        repeatedly.<S ids={[88]} />
      </P>
      <H3>26.1 Persistent session hijacking</H3>
      <P>
        WhatsApp Web sessions remain active even if the user closes the browser
        tab, until the user explicitly logs out from their phone. An attacker
        with physical or remote access to a device long enough to scan a QR code
        can maintain persistent access to a victim's complete WhatsApp account —
        reading messages, contacts, and media — indefinitely and remotely,
        without the victim's knowledge.<S ids={[88]} /> Security researchers
        have demonstrated this repeatedly in controlled settings, and domestic
        abuse researchers have flagged it as a vector for intimate partner
        surveillance.
      </P>
      <H3>26.2 WhatsApp Web and link-preview server-side execution</H3>
      <P>
        The 2020 link-preview research by Bakry and Mysk specifically found that
        WhatsApp Web's server-side link-preview generator — unlike the desktop
        app or mobile app, which generate previews on-device — was downloading
        and rendering link content on Meta's servers and returning a preview
        snippet to the browser.<S ids={[36, 37]} /> This means that for links
        sent via WhatsApp Web, the destination URL is fetched by Meta's
        infrastructure, not by the user's device — creating a server-side log
        of every URL sent through WhatsApp Web, regardless of end-to-end
        encryption of the message payload itself.
      </P>
      <H3>26.3 Electron app security model</H3>
      <P>
        The WhatsApp Desktop application is built on the Electron framework —
        essentially a Chromium browser running a Node.js runtime wrapped in a
        native window. Electron apps, by their nature, have access to Node.js
        APIs, which gives malicious code executed within them full filesystem
        and operating-system access. The 2020 Check Point vulnerability
        (§25.5) was a direct consequence of this: XSS inside the WhatsApp
        Desktop Electron app led directly to native code execution on the host
        operating system.<S ids={[109]} />
      </P>

      {/* 27. GROUPS */}
      <H2 id="groups">27. WhatsApp Groups: Mass Privacy Implications</H2>
      <P>
        WhatsApp groups — which can contain up to 1,024 members as of 2024 —
        represent one of the platform's most significant privacy challenges. A
        group is not a private conversation between two people who have chosen
        to share data with each other; it is a semi-open broadcast environment
        where every participant can see every other participant's phone number
        and profile photo, often without any prior relationship or consent.
      </P>
      <H3>27.1 Phone number exposure</H3>
      <P>
        When you are added to a WhatsApp group — by anyone who has your number
        — your phone number becomes visible to all other group members,
        regardless of your privacy settings for non-contacts.<S ids={[1, 4]} />
        In groups with hundreds of members that are primarily composed of people
        who do not know each other — political groups, neighbourhood groups,
        professional groups — this exposes your phone number to a large set of
        strangers, against whom you have no recourse under WhatsApp's current
        architecture.
      </P>
      <H3>27.2 Group link indexing</H3>
      <P>
        WhatsApp's "Invite Link" feature generates a URL that, when shared,
        allows anyone with the link to join a group. Researchers have found
        thousands of these links indexed in Google search results, on
        WhatsApp-directory websites, and on social media platforms — meaning
        groups whose administrators believed were private were publicly
        joinable.<S ids={[33]} /> Once a person joins a group via an indexed
        link, they gain access to the phone numbers and profile photos of all
        existing members.
      </P>
      <H3>27.3 Administrative surveillance in groups</H3>
      <P>
        Group administrators can see, and are notified of, every participant
        join and leave event, every admin action, and can send broadcast
        messages. In corporate contexts, employers creating WhatsApp groups for
        employees create a channel in which management has visibility of
        engagement patterns — who reads messages (via blue ticks), at what
        time, whether they are "online" — that goes beyond what is typically
        acceptable in formal employment communications.
      </P>

      {/* 28. COVID */}
      <H2 id="covid">28. COVID-19: WhatsApp as a Misinformation Accelerator</H2>
      <P>
        When COVID-19 was declared a pandemic on 11 March 2020, WhatsApp became
        one of the primary channels through which health misinformation spread
        globally. The WHO coined the term <strong>"infodemic"</strong> — an
        overabundance of information, some accurate and some not, that makes it
        hard for people to find trustworthy sources — and WhatsApp was among
        the most powerful engines of that infodemic.<S ids={[111, 112]} />
      </P>
      <H3>28.1 What spread on WhatsApp</H3>
      <P>
        Documented disinformation categories circulated at scale on WhatsApp
        during 2020–2021 included:<S ids={[112, 113]} />
      </P>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>Claims that 5G mobile networks caused or spread COVID-19, leading to physical attacks on mobile phone towers across the UK and multiple other countries.<S ids={[113]} /></li>
        <li>False cures — drinking bleach, holding breath for 10 seconds as a "self-test," gargling with saline or alcohol — that circulated as authoritative voice notes and "doctor-certified" documents.<S ids={[112, 113]} /></li>
        <li>Anti-vaccine misinformation before vaccines were available, and then specific fabrications about vaccine contents, effects, and casualty rates once rollout began.<S ids={[113]} /></li>
        <li>Specific targeting of minority communities with fabricated narratives suggesting particular ethnic groups were vectors of transmission.<S ids={[113]} /></li>
      </ul>
      <H3>28.2 WhatsApp's response — forwarding limits globally</H3>
      <P>
        On 7 April 2020, WhatsApp announced a global restriction: any message
        that had already been forwarded five or more times could now only be
        forwarded to <strong>one chat at a time</strong>, down from the
        previous limit of five.<S ids={[70, 112]} /> Research subsequently
        published by WhatsApp itself claimed this reduced the forwarding of
        "highly forwarded" messages by 70%. However, researchers noted that the
        restriction did not reduce the total volume of misinformation — it
        simply required operators to re-originate content in more groups rather
        than forwarding it, which slowed but did not stop organised
        operations.<S ids={[70, 112]} />
      </P>
      <Callout tone="warn" title="The fundamental tension">
        WhatsApp's COVID-19 response illustrates the platform's fundamental
        policy dilemma: end-to-end encryption that is strong enough to protect
        dissidents from state surveillance is also strong enough to make
        coordinated misinformation campaigns invisible to platform moderators.
        WhatsApp has no ability to scan the content of messages for
        misinformation — by design — which means its only levers are
        forwarding friction, metadata-based pattern detection, and user
        reporting, all of which are inadequate against organised,
        well-resourced operations.<S ids={[111, 112, 113]} />
      </Callout>

      {/* 29. HAUGEN */}
      <H2 id="haugen">29. Frances Haugen &amp; the Internal Meta Documents</H2>
      <P>
        In September and October 2021, Frances Haugen — a former Facebook
        product manager who had worked on civic integrity and counter-espionage
        — provided tens of thousands of pages of internal Facebook documents to
        The Wall Street Journal, the US Congress, and a consortium of
        international news organisations. The disclosures, published as "The
        Facebook Files," provided a rare inside view of what Meta's own
        researchers knew and when they knew it.<S ids={[114, 115]} />
      </P>
      <H3>29.1 What the internal documents revealed</H3>
      <P>
        While the bulk of the Facebook Files focused on Facebook and Instagram,
        several disclosures were directly relevant to WhatsApp:
      </P>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>Internal research showing that Meta's own teams understood that WhatsApp groups were being used for coordinated disinformation and coordinated inauthentic behaviour across multiple markets, and that the platform had limited technical tools to address this without breaking end-to-end encryption.<S ids={[115]} /></li>
        <li>Internal discussions about the trade-off between privacy (E2EE) and safety (content moderation), with senior executives consistently prioritising the privacy narrative — partly because it served as a regulatory shield against demands to access message content.<S ids={[114, 115]} /></li>
        <li>Data showing that WhatsApp's user-reporting tools (the only way users can flag harmful content) were severely underused in markets outside North America and Western Europe, creating significant global safety blind spots.<S ids={[115]} /></li>
      </ul>
      <H3>29.2 ProPublica: how WhatsApp moderates content despite E2EE</H3>
      <P>
        A September 2021 ProPublica investigation revealed that WhatsApp employs
        more than 1,000 contractors in Austin, Texas, and other locations whose
        job is to review content that has been <em>reported</em> by users —
        and that this process includes reading the specific reported message
        content and up to five preceding messages for context.<S ids={[132]} />
        The report highlighted that WhatsApp's claim "no one can read your
        messages, not even WhatsApp" is technically true for un-reported
        messages, but once a user reports a message, that message's content —
        decrypted, because the reporting user's device decrypts and uploads it
        — is readable by WhatsApp contractors.<S ids={[132]} /> This is a
        legitimate and necessary function for trust-and-safety enforcement,
        but it is rarely explained clearly in WhatsApp's public privacy
        messaging.
      </P>

      {/* 30. CHILDREN */}
      <H2 id="children">30. Children on WhatsApp: Age Verification Failures</H2>
      <P>
        WhatsApp's Terms of Service require users to be at least 13 years old
        in most countries (16 in the EU/EEA, per GDPR Article 8, and in certain
        other jurisdictions). The verification mechanism is: a user types in
        their date of birth at registration.<S ids={[126]} /> There is no
        independent age verification — no credit card check, no parental
        consent mechanism, no government ID — making WhatsApp's age gate
        essentially honoured on a good-faith basis by users who can trivially
        bypass it by entering a false birthdate.<S ids={[125, 127, 135]} />
      </P>
      <H3>30.1 The ICO's action against WhatsApp</H3>
      <P>
        In August 2021 the UK Information Commissioner's Office issued a formal
        reprimand to WhatsApp Ireland Ltd regarding WhatsApp's processing of
        children's data. The reprimand found that WhatsApp had failed to
        adequately assess and mitigate the risks to children using the platform
        and had insufficient safeguards to prevent children under 13 from
        registering accounts — even though WhatsApp's own research suggested
        significant underage usage in the UK.<S ids={[127]} />
      </P>
      <H3>30.2 What this means for children's privacy</H3>
      <P>
        A child who registers on WhatsApp — regardless of age — immediately
        uploads their entire phone contacts list (including adults and other
        children), begins generating the full metadata profile described in §3
        and §4, and may be added to groups by any adult who has their phone
        number. The platform has no parental visibility tools, no separate
        children's account mode, and no mechanism for a parent to monitor or
        control their child's WhatsApp usage in a privacy-preserving
        way.<S ids={[125, 127, 135]} /> Child safety organisations including the
        NSPCC have repeatedly called for stronger age assurance requirements
        to be applied to WhatsApp specifically.<S ids={[135]} />
      </P>

      {/* 31. DMA */}
      <H2 id="dma">31. The EU Digital Markets Act &amp; WhatsApp's Obligations</H2>
      <P>
        On 6 September 2023, the European Commission formally designated
        WhatsApp as a <em>gatekeeper</em> under the EU Digital Markets Act
        (DMA) — the most significant piece of platform regulation in EU
        history.<S ids={[128]} /> WhatsApp was designated alongside Facebook
        Messenger, as two of Meta's six gatekeeper core platform services.
      </P>
      <H3>31.1 What the DMA requires of WhatsApp</H3>
      <P>
        Under the DMA, WhatsApp must — within prescribed timelines — provide
        interoperability to third-party messaging services that request it. This
        means users of other messaging apps must, in principle, be able to send
        and receive messages with WhatsApp users without having a WhatsApp
        account.<S ids={[128, 129]} /> WhatsApp began accepting interoperability
        requests in March 2024, but the technical implementation of E2EE
        interoperability across incompatible cryptographic protocols remains an
        extremely complex unsolved problem.
      </P>
      <H3>31.2 Non-compliance proceedings against Meta</H3>
      <P>
        On 25 March 2024, the European Commission opened formal non-compliance
        proceedings against Meta — including WhatsApp — related to other DMA
        obligations, specifically the requirement that Meta not combine personal
        data across its core platform services (Facebook, Instagram, Messenger,
        WhatsApp) for advertising purposes without meeting EU legal
        standards.<S ids={[129]} /> The investigation remains open. If found in
        breach, Meta faces fines of up to 10% of global annual turnover — and
        up to 20% for repeat infringements.
      </P>

      {/* 32. INDIA IT RULES */}
      <H2 id="india_it_rules">32. India's IT Rules 2021 vs. WhatsApp — The Traceability Demand</H2>
      <P>
        On 25 February 2021, India's Ministry of Electronics and Information
        Technology notified the Information Technology (Intermediary Guidelines
        and Digital Media Ethics Code) Rules, 2021 — commonly called the IT
        Rules 2021.<S ids={[122]} /> One of the most controversial provisions
        of these rules requires "significant social media intermediaries" (those
        with more than 5 million registered users) — of which WhatsApp is by
        far the largest in India, with 500+ million users — to enable the
        identification of the <em>"first originator"</em> of any message that
        is ordered to be traced by a court or competent authority.
      </P>
      <H3>32.1 Why this is technically incompatible with E2EE</H3>
      <P>
        WhatsApp challenged these rules in the Delhi High Court in May 2021,
        arguing that building a traceability mechanism into WhatsApp would
        require either: (a) breaking end-to-end encryption for all users
        globally, or (b) storing a hash or fingerprint of every message and its
        sender, permanently, in a format accessible to Indian authorities on
        demand — which would effectively constitute mass surveillance of
        500 million people for the purpose of identifying a small number of
        criminal senders.<S ids={[123, 124]} /> MIT Technology Review's analysis
        confirmed the technical correctness of WhatsApp's argument: there is no
        cryptographically sound way to trace a forwarded message's origin
        without either breaking E2EE or building a surveillance
        infrastructure.<S ids={[124]} />
      </P>
      <H3>32.2 The broader encryption policy battle</H3>
      <P>
        India is not alone. The UK's Online Safety Act 2023 initially contained
        provisions that would have required platforms including WhatsApp to scan
        encrypted messages for illegal content — a technical impossibility without
        breaking E2EE that led WhatsApp and Signal to publicly threaten to
        withdraw from the UK market rather than comply.<S ids={[137, 138]} />
        The UK government ultimately deferred implementation of the scanning
        provisions pending further technical review.<S ids={[139]} /> Australia's
        Assistance and Access Act, the EU's Chat Control proposals, and similar
        legislation in Brazil all represent ongoing attempts by governments to
        compel access to encrypted communications — with WhatsApp's massive user
        base making it the primary target in each jurisdiction.
      </P>

      {/* 33. SIGNAL VS */}
      <H2 id="signal_vs">33. Signal vs. WhatsApp: What You Actually Trade Away</H2>
      <P>
        The most common question raised by privacy-conscious users is: if both
        Signal and WhatsApp use the Signal Protocol for end-to-end encryption,
        why does it matter which one you use? The answer lies entirely in
        everything outside the encryption layer — the business model, the parent
        company, the metadata retained, the open-source auditability, and the
        regulatory exposure.<S ids={[117, 118, 119]} />
      </P>
      <H3>33.1 A direct comparison</H3>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li><strong>Message content encryption:</strong> Identical. Both use the Signal Protocol. A message in transit is equally protected in both apps.<S ids={[89, 90]} /></li>
        <li><strong>Metadata collected:</strong> Signal collects your phone number and the date you last connected — nothing else. WhatsApp collects the full stack described in §3 and §4.<S ids={[17, 131]} /></li>
        <li><strong>Contact graph:</strong> Signal does not upload your address book to its servers — it uses a privacy-preserving cryptographic technique to check whether your contacts are Signal users without Signal ever seeing the contact list. WhatsApp uploads your full address book, including numbers of non-users.<S ids={[1, 4, 119]} /></li>
        <li><strong>Backups:</strong> Signal has no cloud backup by default. WhatsApp backs up to Google Drive/iCloud by default, unencrypted unless the user opts in to E2EE backup.<S ids={[8, 9, 119]} /></li>
        <li><strong>Parent company:</strong> Signal is operated by the Signal Foundation, a non-profit. WhatsApp is operated by Meta Platforms, Inc., whose primary revenue source is advertising.<S ids={[51, 118]} /></li>
        <li><strong>Open source:</strong> Signal's client and server code are both open source and independently audited. WhatsApp's client code is proprietary; the server is entirely closed.<S ids={[118, 119]} /></li>
        <li><strong>Law enforcement response per the FBI document:</strong> Signal returns only registration date and last-connected date. WhatsApp returns subscriber info, address-book contacts, contacts who have the target in their book, and near-real-time pen-register data.<S ids={[17, 131]} /></li>
        <li><strong>Ads:</strong> Signal has no ads, no ad network, no ad-targeting data. WhatsApp introduced ads in the Updates tab in June 2025.<S ids={[11, 12, 13, 118]} /></li>
      </ul>
      <Quote cite="Bruce Schneier, Security expert, 'Metadata: The Most Damaging Intelligence' [130]">
        The NSA doesn't want to read your email. It wants to know who you're
        talking to, when, and how often — because that's what tells them what
        they actually want to know.
      </Quote>
      <P>
        That observation, made in the context of government surveillance, applies
        equally to corporate surveillance. The "envelope" of your communications
        — the metadata — is often more revealing than the content. WhatsApp
        hands that envelope to Meta. Signal does not.<S ids={[130, 134]} />
      </P>

      {/* 34. DISAPPEARING MESSAGES */}
      <H2 id="disappearing">34. Disappearing Messages — What Actually Gets Deleted</H2>
      <P>
        WhatsApp offers a "Disappearing Messages" feature that can be set to
        delete messages after 24 hours, 7 days, or 90 days after they are
        sent.<S ids={[120]} /> It is one of WhatsApp's most heavily marketed
        privacy features. It is also one of its most misunderstood.
      </P>
      <H3>34.1 What disappearing messages actually do</H3>
      <P>
        Disappearing messages delete the message from both the sender's and
        recipient's devices after the selected timer — but only if both devices
        are online and have received the deletion signal.<S ids={[120, 121]} />
        They do <em>not</em>:
      </P>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>Delete the message from a cloud backup, if the backup was taken before the deletion timer fired.<S ids={[8, 120]} /></li>
        <li>Prevent the recipient from taking a screenshot or screen recording before the timer fires — WhatsApp does not block or notify on screenshots in disappearing-message chats (unlike Signal).<S ids={[121]} /></li>
        <li>Delete forwarded copies of the message sent by the recipient to other chats — once forwarded, the disappearing-message timer no longer applies to the copy.<S ids={[120]} /></li>
        <li>Delete media files that were automatically downloaded to the recipient's device before the timer fired.<S ids={[120]} /></li>
        <li>Delete the message from a device that was offline for the entire duration of the timer — the message will simply never be delivered, but WhatsApp's servers may retain the encrypted payload for up to 30 days while waiting for the device to reconnect.<S ids={[120, 121]} /></li>
      </ul>
      <Callout tone="warn" title="The performance of privacy vs. actual privacy">
        Disappearing messages give the sender a feeling of control — a sense
        that the conversation is "self-deleting." In practice, for a determined
        recipient, or for any interaction involving cloud backups, the message
        is extremely unlikely to actually disappear. The feature is more
        accurately described as "reduces casual long-term accumulation of
        conversation history on devices" — which is useful, but is not the
        strong privacy guarantee the name implies.<S ids={[120, 121]} />
      </Callout>

      {/* 35. EXPERTS */}
      <H2 id="experts">35. What Experts, Courts &amp; Whistleblowers Recommend</H2>
      <P>
        This article has assembled evidence from regulatory findings, court
        documents, forensic research, and investigative journalism. It is worth
        stepping back and asking: in the face of all of this evidence, what do
        the people with the deepest expertise actually recommend?
      </P>
      <H3>35.1 Security experts and cryptographers</H3>
      <P>
        Bruce Schneier, one of the most respected security researchers in the
        world, has written extensively on the primacy of metadata as a
        surveillance tool: <em>"Collecting metadata on people is still an
        intimate violation of privacy."</em><S ids={[130]} /> The Electronic
        Frontier Foundation's Surveillance Self-Defence guide specifically
        recommends Signal over WhatsApp for users facing government surveillance,
        citing WhatsApp's metadata collection, its closed-source server, and its
        parent company's record.<S ids={[117, 118]} />
      </P>
      <H3>35.2 Regulatory bodies</H3>
      <P>
        Ireland's Data Protection Commission has fined WhatsApp €225 million
        and found it in breach of GDPR's transparency obligations.<S ids={[27, 28]} />
        India's Competition Commission found the 2021 policy to be an abuse of
        dominant position.<S ids={[29, 30]} /> The EU's Digital Markets Act has
        designated WhatsApp a gatekeeper and opened non-compliance proceedings
        against Meta.<S ids={[128, 129]} /> The UK ICO reprimanded WhatsApp
        over children's data.<S ids={[127]} /> Turkey, Germany, and Brazil have
        all taken enforcement action.<S ids={[65, 66, 93, 94]} /> There is no
        major democratic jurisdiction that has completed a full investigation of
        WhatsApp's data practices and found them to be compliant and acceptable.
      </P>
      <H3>35.3 Whistleblowers</H3>
      <P>
        Brian Acton and Jan Koum — the people who built WhatsApp, who know its
        codebase better than anyone alive — walked away from billions of dollars
        rather than implement what Meta planned to do with WhatsApp's
        data.<S ids={[55, 56, 57, 58]} /> Frances Haugen's internal documents
        show that Meta's own researchers identified serious safety and privacy
        problems with WhatsApp's architecture and product decisions — and that
        leadership consistently prioritised growth and engagement over
        addressing those problems.<S ids={[114, 115]} />
      </P>
      <H3>35.4 Courts</H3>
      <P>
        A US federal jury in 2025 held that NSO Group's use of WhatsApp as a
        delivery vector for nation-state spyware against 1,400 people was
        unlawful and awarded $167 million in punitive damages — a verdict that
        implicitly confirmed both the scale of the abuse and the structural
        attractiveness of WhatsApp as a high-value target for any entity with
        the capability to exploit it.<S ids={[18, 19, 20, 21, 22]} />
      </P>
      <Quote cite="Amnesty International, on the NSO verdict, May 2025 [20]">
        This verdict sends a powerful message: the impunity that spyware
        vendors have enjoyed must come to an end. No company that profits from
        surveillance against journalists, activists and human rights defenders
        should be allowed to operate with impunity.
      </Quote>
      <P>
        The question this article poses is not whether WhatsApp is a bad
        product. It is whether, in 2025 and beyond, the sum of evidence — the
        metadata collection, the parent-company data flows, the ad
        introduction, the AI integration, the broken features, the regulatory
        findings, the spyware verdicts, the election interference record, the
        genocide link, the children's data failures, the payments data
        ambitions — is consistent with the trust that three billion people place
        in a green lock icon and the words "end-to-end encrypted."<S ids={[1, 18, 27, 51, 98, 102, 114, 128]} />
      </P>
      <P>
        The evidence in this document says: it is not.
      </P>
    </>
  );
}

/* ───────────────────────────── HINDI ARTICLE ───────────────────────────── */

function ArticleHindi() {
  return (
    <>
      <PrivacyRiskCalculator lang="hi" />
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

      {/* 22. MYANMAR */}
      <H2 id="myanmar">22. WhatsApp और रोहिंग्या नरसंहार</H2>
      <P>
        WhatsApp के विकासशील दुनिया में फैलाव का सबसे गंभीर वास्तविक परिणाम कोई
        नियामक जुर्माना या स्पाइवेयर का मुकदमा नहीं है — वह एक नरसंहार है।
        अगस्त-सितंबर 2017 के बीच, म्यांमार की सेना ने रोहिंग्या मुसलमानों के
        विरुद्ध जातीय सफ़ाई का अभियान चलाया जिसे UN ने "जातीय सफ़ाई का पाठ्यपुस्तक
        उदाहरण" और 2018 की तथ्य-खोज मिशन रिपोर्ट में "नरसंहार की विशेषताएँ रखने
        वाला" बताया।<S ids={[98]} />
      </P>
      <P>
        Facebook — और उसी platform infrastructure के ज़रिए WhatsApp — वह मुख्य
        माध्यम बन गया जिससे रोहिंग्या विरोधी नफ़रत भरी बातें, अपमानजनक चित्र और
        हिंसा के लिए खुले आह्वान म्यांमार समाज में फैले।<S ids={[99, 100]} />
        नवंबर 2018 में Facebook की अपनी आंतरिक टीम ने BBC को स्वीकार किया कि
        platform का उपयोग "ऑफ़लाइन हिंसा भड़काने" के लिए किया गया।<S ids={[100]} />
        New York Times ने अक्टूबर 2018 की गहन रिपोर्ट में दस्तावेज़ किया कि सैन्य
        अधिकारी और उनके प्रतिनिधि Facebook और WhatsApp के ज़रिए झूठी ख़बरें,
        बौद्ध भिक्षुओं के नाम से बनाए गए फ़र्ज़ी उद्धरण और सच बताने की कोशिश करने
        वाले पत्रकारों के ख़िलाफ़ समन्वित उत्पीड़न अभियान चला रहे थे।<S ids={[99]} />
      </P>
      <H3>22.1 UN का सीधा निष्कर्ष</H3>
      <P>
        UN तथ्य-खोज मिशन की सितंबर 2018 की रिपोर्ट सोशल मीडिया की भूमिका पर
        स्पष्ट है: <em>"सोशल मीडिया — विशेष रूप से Facebook — नफ़रत भरी बातें
        फैलाने के इच्छुक लोगों के लिए एक उपयोगी साधन रहा है, और इसने कभी-कभी
        वास्तविक दुनिया में हिंसा को जन्म दिया है।"</em><S ids={[98]} />
      </P>
      <H3>22.2 $150 अरब का मुकदमा</H3>
      <P>
        दिसंबर 2021 में रोहिंग्या शरणार्थी समूहों ने कैलिफ़ोर्निया में Meta के
        ख़िलाफ़ <strong>$150 अरब</strong> के हर्जाने का दावा दाखिल किया। दावे में
        कहा गया कि Meta के algorithms और platforms की पहुँच ने नफ़रत भरी सामग्री को
        बढ़ावा दिया और उसे recommend किया, और Meta ने 2013 से ही शोधकर्ताओं,
        पत्रकारों और civil society की बार-बार की चेतावनियों को नज़रअंदाज़ किया।<S ids={[101]} />
      </P>
      <Callout tone="danger" title="WhatsApp के लिए यह विशेष रूप से क्यों मायने रखता है">
        म्यांमार में WhatsApp की भूमिका एक विशिष्ट, दस्तावेज़ीकृत उदाहरण है उस
        परिस्थिति का जब end-to-end encrypted messaging network को कम media literacy
        वाले समाज में, स्थानीय भाषाओं में inadequate content moderation के साथ और
        एक सेना द्वारा जो जानकारी को हथियार बनाना चाहती है — तैनात किया जाता है।
        वही encryption जो democracies में dissidents की रक्षा करती है, उसी ने
        म्यांमार में समन्वित नफ़रत अभियानों को moderators से छुपाया।<S ids={[98, 99, 100, 101]} />
      </Callout>

      {/* 23. BRAZIL 2018 */}
      <H2 id="brazil2018">23. ब्राज़ील 2018 — WhatsApp एक 'दुष्प्रचार मशीन' के रूप में</H2>
      <P>
        2018 के ब्राज़ीलियाई राष्ट्रपति चुनाव ने WhatsApp-native दुष्प्रचार
        अभियान का पहला बड़ा दस्तावेज़ीकृत मामला सामने रखा। Jair Bolsonaro 28
        अक्टूबर 2018 को राष्ट्रपति बने। साओ पाउलो विश्वविद्यालय के शोधकर्ताओं,
        बाद में Oxford Internet Institute और MIT Technology Review ने पुष्टि की कि
        एक व्यवस्थित, अच्छी तरह से वित्त पोषित अभियान में WhatsApp Groups —
        Facebook timelines नहीं — फ़र्ज़ी ख़बरों, संदर्भ से बाहर छवियों और
        हेरफेर किए गए वीडियो के प्राथमिक वितरण चैनल के रूप में काम आए।<S ids={[102, 103, 104]} />
      </P>
      <H3>23.1 कॉर्पोरेट bulk-messaging अभियान</H3>
      <P>
        The Guardian और ब्राज़ीलियाई मीडिया ने रिपोर्ट किया कि Bolsonaro के
        व्यापारिक समर्थकों ने सामूहिक रूप से bulk WhatsApp messaging services के
        लिए भुगतान किया जिन्होंने हज़ारों WhatsApp Groups में पहले से बने
        दुष्प्रचार पैकेज डाले — WhatsApp की अपनी terms of service का उल्लंघन, पर
        ऐसा जिसे WhatsApp की architecture के चलते पता लगाना बेहद मुश्किल
        था।<S ids={[102, 103]} /> ब्राज़ीलियाई चुनाव अभियोजकों ने इसे
        <em>"दुष्प्रचार पारिस्थितिकी तंत्र"</em> कहा।
      </P>
      <H3>23.2 ढाँचागत समस्या</H3>
      <P>
        WhatsApp को चुनाव प्रभाव के रूप में विशेष रूप से खतरनाक बनाने वाली वही
        संपत्ति है जो इसे संचार उपकरण के रूप में आकर्षक बनाती है — private,
        encrypted group messages जो social network की गति से फैलते हैं पर fact-checkers,
        पत्रकारों, चुनाव पर्यवेक्षकों और platform की अपनी trust-and-safety टीमों
        के लिए अदृश्य हैं।<S ids={[103, 104]} /> Twitter पर एक झूठी ख़बर को एक
        पत्रकार घंटों में खंडन कर सकता है। वही ख़बर 10,000 private WhatsApp Groups
        में forward होकर बिना किसी सार्वजनिक जवाबदेही के करोड़ों लोगों तक
        पहुँचती है।<S ids={[104]} />
      </P>

      {/* 24. WHATSAPP PAY */}
      <H2 id="whatsapppay">24. WhatsApp Pay — आपका वित्तीय डेटा</H2>
      <P>
        WhatsApp Pay 2020 में ब्राज़ील में और 2020 के अंत में भारत में लॉन्च हुआ।
        भारत में NPCI से दो साल की नियामक मंजूरी प्रक्रिया के बाद, सेवा UPI
        भुगतान को सीधे WhatsApp चैट के भीतर peer-to-peer तरीक़े से करने की
        अनुमति देती है।<S ids={[140, 141]} />
      </P>
      <H3>24.1 WhatsApp कौन सा वित्तीय डेटा इकट्ठा करता है</H3>
      <P>
        WhatsApp की Privacy Policy स्पष्ट रूप से <em>"भुगतान या वित्तीय जानकारी"</em>
        को उस डेटा में शामिल करती है जो वह इकट्ठा करता है।<S ids={[1]} />
        जब आप WhatsApp Pay का उपयोग करते हैं, तो निम्नलिखित अतिरिक्त डेटा
        श्रेणियाँ उत्पन्न और एकत्र होती हैं:
      </P>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>भुगतान लेनदेन राशि, तारीख़ें और प्राप्तकर्ता/व्यापारी पहचान।<S ids={[1, 140]} /></li>
        <li>UPI ID और लिंक बैंक खाता।<S ids={[140, 141]} /></li>
        <li>लेनदेन इतिहास और patterns — किसे भुगतान किया, कितना, कितनी बार।<S ids={[1, 140]} /></li>
        <li>भुगतान के समय device और IP पता।<S ids={[1, 2]} /></li>
      </ul>
      <P>
        Payment data सबसे intimate डेटा में से एक है। WhatsApp पहले से जो metadata
        रखता है — social graph, device, location, communication patterns —
        उसके साथ transaction history जोड़ने पर Meta आपकी आय स्तर, खपत की आदतें,
        राजनीतिक दान, धार्मिक दान, चिकित्सा खर्च और संबंध नेटवर्क का अनुमान
        लगा सकता है।<S ids={[130, 134, 140]} />
      </P>

      {/* 25. CVEs */}
      <H2 id="cves">25. गंभीर सुरक्षा कमज़ोरियों की सूची (CVE)</H2>
      <P>
        WhatsApp का एक सार्वजनिक security advisory कार्यक्रम है और इसने अपने इतिहास
        में कई गंभीर, remotely exploitable कमज़ोरियाँ सार्वजनिक की हैं। निम्नलिखित
        सबसे महत्वपूर्ण सार्वजनिक मामलों का चयन है।<S ids={[136]} />
      </P>
      <H3>25.1 CVE-2019-3568 — Pegasus zero-click (मई 2019)</H3>
      <P>
        WhatsApp के public record में सबसे महत्वपूर्ण कमज़ोरी। WhatsApp के VOIP
        stack में buffer overflow ने attackers को किसी crafted SRTP packet भेजकर
        arbitrary code execute करने दिया — बिना किसी user interaction, बिना call
        उठाए, बिना call log में कोई निशान छोड़े।<S ids={[105]} /> CVSS score:
        <strong> 9.8 (Critical)</strong>। इस कमज़ोरी का हथियार के रूप में NSO
        Group के Pegasus ने इस्तेमाल किया — 20 देशों में 1,400+ users को निशाना
        बनाया।<S ids={[19, 21, 105]} />
      </P>
      <H3>25.2 CVE-2022-36934 — Integer overflow RCE (सितंबर 2022)</H3>
      <P>
        Android और iOS के लिए WhatsApp में एक critical integer overflow कमज़ोरी
        जो किसी video call के दौरान remote code execution की अनुमति दे सकती थी —
        call receive करने के अलावा किसी user interaction की आवश्यकता
        नहीं।<S ids={[106]} /> CVSS score: <strong>9.8 (Critical)</strong>।
      </P>
      <H3>25.3 CVE-2022-27492 — Video parsing में Integer underflow (सितंबर 2022)</H3>
      <P>
        WhatsApp के video file parsing logic में integer underflow flaw जिसने
        attachment खोलने पर code execution को trigger किया —
        <em>one-click exploit</em>।<S ids={[107]} /> CVSS score:
        <strong> 7.8 (High)</strong>।
      </P>
      <H3>25.4 WhatsApp Desktop — malicious links के ज़रिए code execution (2020)</H3>
      <P>
        Check Point Research ने फरवरी 2020 में खुलासा किया कि WhatsApp Desktop
        (Electron-based app) एक crafted message link के ज़रिए XSS attack के
        प्रति संवेदनशील था, जिसका उपयोग victim की machine पर Python या PHP code
        execute करने के लिए किया जा सकता था।<S ids={[109]} /> Check Point ने
        पहले 2019 में एक संबंधित कमज़ोरी का खुलासा किया था जिसने private group
        conversations में quoted messages को modify करने और senders का
        प्रतिरूपण करने की अनुमति दी।<S ids={[110]} />
      </P>

      {/* 26. WEB DESKTOP */}
      <H2 id="webdesktop">26. WhatsApp Web और Desktop — बड़ा हमले का क्षेत्र</H2>
      <P>
        WhatsApp Web और Desktop application WhatsApp की पहुँच को phone से परे
        बढ़ाते हैं। यह QR code scan के ज़रिए phone के account को browser session
        या Electron app से जोड़ता है। सुविधाजनक होने के साथ-साथ यह एक अतिरिक्त
        attack surface बनाता है जिसका बार-बार शोषण हुआ है।<S ids={[88]} />
      </P>
      <H3>26.1 Persistent session hijacking</H3>
      <P>
        WhatsApp Web sessions active रहती हैं जब तक user अपने phone से explicitly
        logout नहीं करता। एक attacker जिसकी device तक physical या remote पहुँच है,
        वह QR code scan करके victim के पूरे WhatsApp account — messages, contacts,
        media — तक अनिश्चित काल के लिए और remotely पहुँच बना सकता है, बिना victim
        की जानकारी के।<S ids={[88]} />
      </P>
      <H3>26.2 Link-preview से server-side IP logging</H3>
      <P>
        2020 की link-preview research में पाया गया कि WhatsApp Web का server-side
        link-preview generator — जो mobile/desktop app के विपरीत — links को Meta
        के servers पर fetch और render करता था।<S ids={[36, 37]} /> इसका मतलब है
        कि WhatsApp Web के ज़रिए भेजे गए links के लिए destination URL Meta की
        infrastructure द्वारा fetch की जाती है — message payload की E2EE की परवाह
        किए बिना।
      </P>

      {/* 27. GROUPS */}
      <H2 id="groups">27. WhatsApp ग्रुप — सामूहिक प्राइवेसी के खतरे</H2>
      <P>
        WhatsApp Groups — जिनमें 2024 तक 1,024 सदस्य हो सकते हैं — platform की
        सबसे महत्वपूर्ण गोपनीयता चुनौतियों में से एक हैं। एक group दो लोगों के
        बीच की private बातचीत नहीं है — यह एक अर्ध-खुला broadcast environment है
        जहाँ हर participant हर दूसरे participant का phone number और profile photo
        देख सकता है।
      </P>
      <H3>27.1 Phone number exposure</H3>
      <P>
        जब आपको किसी WhatsApp group में जोड़ा जाता है — जिसके पास भी आपका number
        है — आपका phone number सभी group members को दिखने लगता है, भले ही आपकी
        non-contacts के लिए privacy settings कुछ भी हों।<S ids={[1, 4]} />
        इसका मतलब है कि political groups, neighbourhood groups, professional
        groups जैसे सैकड़ों members वाले groups में आपका number अजनबियों को दिख
        जाता है, जिनके ख़िलाफ़ WhatsApp की current architecture में आपके पास
        कोई उपाय नहीं है।
      </P>
      <H3>27.2 Group link indexing</H3>
      <P>
        WhatsApp का "Invite Link" feature एक URL generate करता है। Researchers ने
        Google search results में हज़ारों ऐसे links indexed पाए, जिसका मतलब है
        कि जिन groups को administrators ने private समझा था, वे publicly joinable
        थे।<S ids={[33]} /> Group link के ज़रिए join करने वाला कोई भी person
        सभी existing members के phone numbers और profile photos तक पहुँच जाता है।
      </P>

      {/* 28. COVID */}
      <H2 id="covid">28. COVID-19 — WhatsApp एक गलत सूचना का त्वरक</H2>
      <P>
        जब 11 मार्च 2020 को COVID-19 को pandemic घोषित किया गया, WhatsApp वैश्विक
        स्वास्थ्य ग़लत सूचना के प्राथमिक चैनलों में से एक बन गया। WHO ने
        <strong>"infodemic"</strong> शब्द गढ़ा — सूचनाओं की अधिकता, जिनमें कुछ
        सही और कुछ ग़लत, जो विश्वसनीय स्रोत खोजना मुश्किल बना देती है — और
        WhatsApp उस infodemic का सबसे शक्तिशाली इंजन था।<S ids={[111, 112]} />
      </P>
      <H3>28.1 WhatsApp पर क्या फैला</H3>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>दावे कि 5G mobile networks ने COVID-19 फैलाया — UK और कई अन्य देशों में mobile towers पर physical attacks हुए।<S ids={[113]} /></li>
        <li>झूठे इलाज — bleach पीना, 10 सेकंड साँस रोकना, saline से gargling — authoritative voice notes के रूप में।<S ids={[112, 113]} /></li>
        <li>Anti-vaccine misinformation और vaccine contents के बारे में fabrications।<S ids={[113]} /></li>
        <li>Minority communities को specific fabrications के ज़रिए transmission का vector बताना।<S ids={[113]} /></li>
      </ul>
      <H3>28.2 WhatsApp का जवाब</H3>
      <P>
        7 अप्रैल 2020 को WhatsApp ने global restriction की घोषणा की: पाँच या उससे
        अधिक बार forward हो चुका कोई भी message अब <strong>एक chat में</strong> ही
        forward किया जा सकता है।<S ids={[70, 112]} /> WhatsApp के अपने दावे के
        अनुसार इससे "highly forwarded" messages की forwarding 70% कम हुई। हालाँकि
        शोधकर्ताओं ने नोट किया कि इससे ग़लत सूचना की कुल मात्रा नहीं घटी — केवल
        organised operations को content को नए groups में re-originate करने की
        आवश्यकता हुई।<S ids={[70, 112]} />
      </P>

      {/* 29. HAUGEN */}
      <H2 id="haugen">29. Frances Haugen और Meta के आंतरिक दस्तावेज़</H2>
      <P>
        सितंबर-अक्टूबर 2021 में Frances Haugen — Facebook के पूर्व product manager
        जो civic integrity पर काम करती थीं — ने दसियों हज़ार internal Facebook
        documents Wall Street Journal, US Congress और international news organisations
        के consortium को दिए। ये "The Facebook Files" के रूप में प्रकाशित हुए।<S ids={[114, 115]} />
      </P>
      <H3>29.1 आंतरिक दस्तावेज़ों ने क्या सामने रखा</H3>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>Internal research दिखाता है कि Meta की अपनी teams को पता था कि WhatsApp groups को multiple markets में coordinated disinformation और inauthentic behaviour के लिए इस्तेमाल किया जा रहा था।<S ids={[115]} /></li>
        <li>Privacy (E2EE) और safety (content moderation) के बीच trade-off पर internal discussions — senior executives ने लगातार privacy narrative को प्राथमिकता दी, आंशिक रूप से इसलिए कि यह message content तक access की माँगों के ख़िलाफ़ regulatory shield का काम करता था।<S ids={[114, 115]} /></li>
        <li>Data दिखाता है कि WhatsApp के user-reporting tools North America और Western Europe के बाहर के markets में बहुत कम use हो रहे थे।<S ids={[115]} /></li>
      </ul>
      <H3>29.2 ProPublica: E2EE के बावजूद WhatsApp content कैसे moderate करता है</H3>
      <P>
        सितंबर 2021 की ProPublica की जाँच में सामने आया कि WhatsApp Austin, Texas
        और अन्य जगहों पर 1,000 से अधिक contractors को employ करता है जो users द्वारा
        report की गई content को review करते हैं — इसमें report किए गए message की
        content और context के लिए पहले के पाँच messages पढ़ना शामिल है।<S ids={[132]} />
        WhatsApp का "कोई भी आपके messages नहीं पढ़ सकता" दावा technically un-reported
        messages के लिए सही है — पर एक बार user किसी message को report करता है,
        उस message की content WhatsApp contractors द्वारा readable हो जाती है।<S ids={[132]} />
      </P>

      {/* 30. CHILDREN */}
      <H2 id="children">30. WhatsApp पर बच्चे — आयु सत्यापन में विफलता</H2>
      <P>
        WhatsApp की Terms of Service अधिकांश देशों में कम से कम 13 साल (EU/EEA में
        GDPR Article 8 के अनुसार 16 साल) की आयु की आवश्यकता रखती है। Verification
        mechanism: user registration पर अपनी जन्मतिथि type करता है।<S ids={[126]} />
        कोई independent age verification नहीं — कोई credit card check नहीं,
        कोई parental consent mechanism नहीं, कोई government ID नहीं — जिससे
        WhatsApp का age gate essentially good-faith basis पर है।<S ids={[125, 127, 135]} />
      </P>
      <H3>30.1 UK ICO की WhatsApp पर कार्रवाई</H3>
      <P>
        अगस्त 2021 में UK Information Commissioner's Office ने WhatsApp Ireland Ltd
        को बच्चों के data processing के बारे में formal reprimand जारी किया।
        Reprimand में पाया गया कि WhatsApp बच्चों पर risks को adequately assess
        और mitigate करने में विफल रहा।<S ids={[127]} />
      </P>
      <H3>30.2 बच्चों की privacy के लिए इसका अर्थ</H3>
      <P>
        WhatsApp पर register करने वाला बच्चा — उम्र चाहे कुछ भी हो — तुरंत अपनी
        पूरी phone contacts list upload करता है, §3 और §4 में वर्णित पूरा metadata
        profile generate करना शुरू करता है, और किसी भी adult द्वारा groups में
        जोड़ा जा सकता है जिसके पास उसका phone number है।<S ids={[125, 127, 135]} />
        NSPCC ने बार-बार WhatsApp के लिए stronger age assurance की माँग की है।<S ids={[135]} />
      </P>

      {/* 31. DMA */}
      <H2 id="dma">31. EU डिजिटल मार्केट्स एक्ट और WhatsApp की ज़िम्मेदारी</H2>
      <P>
        6 सितंबर 2023 को European Commission ने EU Digital Markets Act (DMA) के
        तहत WhatsApp को <em>gatekeeper</em> के रूप में formally designate किया —
        EU history में platform regulation का सबसे महत्वपूर्ण कानून।<S ids={[128]} />
        WhatsApp को Facebook Messenger के साथ Meta के छह gatekeeper core platform
        services में से एक के रूप में designate किया गया।
      </P>
      <H3>31.1 DMA के तहत WhatsApp की ज़िम्मेदारियाँ</H3>
      <P>
        DMA के तहत WhatsApp को निर्धारित समय-सीमाओं के भीतर third-party messaging
        services को interoperability प्रदान करनी होगी। इसका मतलब है कि अन्य
        messaging apps के users को WhatsApp account के बिना WhatsApp users के साथ
        messages भेजने-प्राप्त करने में सक्षम होना चाहिए।<S ids={[128, 129]} />
      </P>
      <H3>31.2 Meta के ख़िलाफ़ non-compliance proceedings</H3>
      <P>
        25 मार्च 2024 को European Commission ने Meta — WhatsApp सहित — के ख़िलाफ़
        formal non-compliance proceedings शुरू किए। यदि उल्लंघन पाया गया, तो Meta
        पर global annual turnover का 10% तक जुर्माना हो सकता है — और बार-बार
        उल्लंघन पर 20%।<S ids={[129]} />
      </P>

      {/* 32. INDIA IT RULES */}
      <H2 id="india_it_rules">32. भारत के IT नियम 2021 बनाम WhatsApp — ट्रेसेबिलिटी की माँग</H2>
      <P>
        25 फरवरी 2021 को भारत के Ministry of Electronics and Information Technology
        ने Information Technology (Intermediary Guidelines and Digital Media Ethics
        Code) Rules, 2021 — सामान्यतः IT Rules 2021 — को अधिसूचित किया।<S ids={[122]} />
        इनमें एक विवादास्पद प्रावधान है कि "significant social media intermediaries"
        — जिनमें WhatsApp (भारत में 500+ million users) अग्रणी है — किसी भी
        message के <em>"first originator"</em> की पहचान सक्षम करें।
      </P>
      <H3>32.1 यह E2EE के साथ तकनीकी रूप से असंगत क्यों है</H3>
      <P>
        WhatsApp ने मई 2021 में Delhi High Court में इन नियमों को चुनौती दी, यह
        तर्क देते हुए कि traceability mechanism बनाने के लिए या तो: (a) सभी users
        के लिए globally end-to-end encryption तोड़नी होगी, या (b) हर message और
        उसके sender का hash/fingerprint permanently store करना होगा।<S ids={[123, 124]} />
        MIT Technology Review के analysis ने WhatsApp के technical तर्क की
        पुष्टि की: E2EE को तोड़े बिना या surveillance infrastructure बनाए बिना
        forward किए गए message के origin का trace करना cryptographically sound
        तरीक़े से संभव नहीं है।<S ids={[124]} />
      </P>
      <H3>32.2 व्यापक encryption नीति की लड़ाई</H3>
      <P>
        भारत अकेला नहीं है। UK के Online Safety Act 2023 में प्रावधान थे जो
        platforms — WhatsApp सहित — को illegal content के लिए encrypted messages
        scan करने की आवश्यकता रखते थे। WhatsApp और Signal ने publicly comply करने
        की बजाय UK market छोड़ने की धमकी दी।<S ids={[137, 138]} /> UK सरकार ने
        अंततः technical review लंबित scanning provisions के implementation को
        स्थगित किया।<S ids={[139]} />
      </P>

      {/* 33. SIGNAL VS */}
      <H2 id="signal_vs">33. Signal vs WhatsApp — आप असल में क्या खो देते हैं</H2>
      <P>
        सबसे आम सवाल: अगर Signal और WhatsApp दोनों Signal Protocol use करते हैं,
        तो क्या फ़र्क पड़ता है? जवाब encryption layer के बाहर सब कुछ में है —
        business model, parent company, retained metadata, open-source auditability,
        और regulatory exposure।<S ids={[117, 118, 119]} />
      </P>
      <H3>33.1 तुलनात्मक विश्लेषण</H3>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li><strong>Message content encryption:</strong> समान। दोनों Signal Protocol use करते हैं।<S ids={[89, 90]} /></li>
        <li><strong>Collected metadata:</strong> Signal सिर्फ़ phone number और last connected date collect करता है। WhatsApp §3 और §4 में वर्णित पूरा stack।<S ids={[17, 131]} /></li>
        <li><strong>Contact graph:</strong> Signal address book upload नहीं करता। WhatsApp पूरी address book upload करता है, non-users सहित।<S ids={[1, 4, 119]} /></li>
        <li><strong>Backups:</strong> Signal में default cloud backup नहीं। WhatsApp default रूप से unencrypted Google Drive/iCloud backup।<S ids={[8, 9, 119]} /></li>
        <li><strong>Parent company:</strong> Signal Foundation (non-profit). WhatsApp Meta Platforms, Inc. (advertising revenue)।<S ids={[51, 118]} /></li>
        <li><strong>Open source:</strong> Signal का client और server दोनों open source और independently audited। WhatsApp का client proprietary, server पूरी तरह closed।<S ids={[118, 119]} /></li>
        <li><strong>Law enforcement (FBI document):</strong> Signal सिर्फ़ registration date और last-connected date देता है। WhatsApp subscriber info, contacts, social graph, और near-real-time pen-register data।<S ids={[17, 131]} /></li>
        <li><strong>Ads:</strong> Signal में कोई ad नहीं। WhatsApp ने जून 2025 में Updates tab में ads शुरू किए।<S ids={[11, 12, 13, 118]} /></li>
      </ul>
      <Quote cite="Bruce Schneier, Security expert [130]">
        NSA आपका email पढ़ना नहीं चाहता। वह जानना चाहता है कि आप किससे बात कर
        रहे हैं, कब और कितनी बार — क्योंकि यही उन्हें वह बताता है जो वे जानना
        चाहते हैं।
      </Quote>
      <P>
        यह observation सरकारी निगरानी के context में की गई थी, पर corporate
        surveillance पर समान रूप से लागू होती है। आपके communications का
        "envelope" — metadata — अक्सर content से अधिक revealing होता है।
        WhatsApp वह envelope Meta को देता है। Signal नहीं देता।<S ids={[130, 134]} />
      </P>

      {/* 34. DISAPPEARING */}
      <H2 id="disappearing">34. गायब होने वाले मैसेज — असल में क्या डिलीट होता है</H2>
      <P>
        WhatsApp "Disappearing Messages" feature प्रदान करता है जिसे 24 घंटे,
        7 दिन या 90 दिन बाद messages delete करने के लिए set किया जा सकता है।<S ids={[120]} />
        यह WhatsApp के सबसे heavily marketed privacy features में से एक है —
        और सबसे अधिक misunderstood भी।
      </P>
      <H3>34.1 Disappearing messages असल में क्या करते हैं</H3>
      <P>
        Disappearing messages selected timer के बाद sender और recipient दोनों के
        devices से message delete करते हैं — <em>केवल तभी</em> जब दोनों devices
        online हों और deletion signal receive कर चुके हों।<S ids={[120, 121]} />
        वे <em>नहीं</em> करते:
      </P>
      <ul className="list-disc pl-6 space-y-2 text-[17px] leading-[1.75] text-[#1f2a24] mb-5">
        <li>Timer fire होने से पहले लिए गए cloud backup से message delete नहीं होता।<S ids={[8, 120]} /></li>
        <li>Recipient को timer fire होने से पहले screenshot लेने से नहीं रोकता — WhatsApp disappearing message chats में screenshots block या notify नहीं करता।<S ids={[121]} /></li>
        <li>Recipient द्वारा अन्य chats में forward की गई copies delete नहीं होतीं।<S ids={[120]} /></li>
        <li>Timer fire होने से पहले automatically download हुई media files delete नहीं होतीं।<S ids={[120]} /></li>
        <li>Offline device पर message deliver नहीं होता, पर WhatsApp के servers encrypted payload को 30 दिन तक retain कर सकते हैं।<S ids={[120, 121]} /></li>
      </ul>
      <Callout tone="warn" title="Privacy का आभास बनाम वास्तविक privacy">
        Disappearing messages sender को नियंत्रण का एहसास देते हैं। व्यवहार में,
        किसी determined recipient के लिए या cloud backups वाले किसी भी interaction
        के लिए, message के वास्तव में गायब होने की संभावना बहुत कम है।<S ids={[120, 121]} />
      </Callout>

      {/* 35. EXPERTS */}
      <H2 id="experts">35. विशेषज्ञ, अदालतें और व्हिसलब्लोअर क्या सलाह देते हैं</H2>
      <P>
        यह लेख regulatory findings, court documents, forensic research और
        investigative journalism से साक्ष्य एकत्र करता है। यह पूछना उचित है —
        इस सारे साक्ष्य के सामने, सबसे गहरी विशेषज्ञता वाले लोग वास्तव में क्या
        recommend करते हैं?
      </P>
      <H3>35.1 Security experts और cryptographers</H3>
      <P>
        Bruce Schneier ने metadata की primacy पर विस्तार से लिखा है:
        <em>"लोगों पर metadata collect करना privacy का एक intimate उल्लंघन है।"</em><S ids={[130]} />
        EFF की Surveillance Self-Defence guide विशेष रूप से government surveillance
        का सामना करने वाले users के लिए WhatsApp की बजाय Signal recommend करती है।<S ids={[117, 118]} />
      </P>
      <H3>35.2 नियामक निकाय</H3>
      <P>
        Ireland के DPC ने WhatsApp पर €225 million का जुर्माना लगाया और GDPR की
        transparency obligations का उल्लंघन पाया।<S ids={[27, 28]} /> India के CCI
        ने 2021 की policy को dominant position का दुरुपयोग पाया।<S ids={[29, 30]} />
        EU के DMA ने WhatsApp को gatekeeper designate किया और Meta के ख़िलाफ़
        non-compliance proceedings शुरू किए।<S ids={[128, 129]} /> UK ICO ने
        children's data पर reprimand जारी किया।<S ids={[127]} />
      </P>
      <H3>35.3 व्हिसलब्लोअर</H3>
      <P>
        Brian Acton और Jan Koum — वे लोग जिन्होंने WhatsApp बनाया — अरबों डॉलर
        छोड़कर चले गए बजाय इसके कि Meta जो WhatsApp के data के साथ करना चाहती थी
        वह implement करें।<S ids={[55, 56, 57, 58]} /> Frances Haugen के internal
        documents दिखाते हैं कि Meta के अपने researchers ने WhatsApp की architecture
        और product decisions में गंभीर safety और privacy problems की पहचान की — और
        leadership ने लगातार growth और engagement को उन problems को address करने
        से ऊपर रखा।<S ids={[114, 115]} />
      </P>
      <H3>35.4 अदालतें</H3>
      <P>
        2025 में एक US federal jury ने माना कि NSO Group का WhatsApp का उपयोग
        1,400 लोगों के ख़िलाफ़ nation-state spyware delivery के लिए ग़ैर-क़ानूनी था
        और $167 million के punitive damages दिए।<S ids={[18, 19, 20, 21, 22]} />
      </P>
      <Quote cite="Amnesty International, NSO verdict पर, मई 2025 [20]">
        यह verdict एक शक्तिशाली संदेश भेजता है: spyware vendors को जो दण्डमुक्ति
        मिली है वह समाप्त होनी चाहिए।
      </Quote>
      <P>
        यह लेख जो सवाल पूछता है वह यह नहीं है कि WhatsApp एक बुरा product है।
        सवाल यह है कि 2025 और उसके बाद, साक्ष्यों का योग — metadata collection,
        parent-company data flows, ad introduction, AI integration, broken features,
        regulatory findings, spyware verdicts, election interference, genocide link,
        children's data failures, payments data ambitions — उस भरोसे के अनुरूप है
        या नहीं जो तीन अरब लोग एक हरे lock icon और "end-to-end encrypted" शब्दों
        में रखते हैं।<S ids={[1, 18, 27, 51, 98, 102, 114, 128]} />
      </P>
      <P>
        इस document के साक्ष्य कहते हैं: नहीं।
      </P>
    </>
  );
}

/* ─────────────────── PORTUGUESE ARTICLE ─────────────────── */
function ArticlePt() {
  return (
    <>
      <PrivacyRiskCalculator lang="pt" />
      <H2 id="tldr">Em resumo — o que este artigo prova</H2>
      <ul className="space-y-3 text-[17px] leading-[1.75] text-[#1f2a24] list-none">
        <li><strong>1.</strong> O WhatsApp pertence à Meta — a mesma empresa dona do Facebook, Instagram, Messenger e Threads, envolvida no escândalo Cambridge Analytica de 2018.<S ids={[51, 52, 53, 61]} /></li>
        <li><strong>2.</strong> Os próprios fundadores do WhatsApp romperam com a Meta por causa de dados. Brian Acton twittou <em>"#deletefacebook"</em> em 2018, abrindo mão de US$850 milhões em ações. Jan Koum saiu semanas depois.<S ids={[54, 55, 56, 57, 58]} /></li>
        <li><strong>3.</strong> A Política de Privacidade do WhatsApp confirma a coleta de número de telefone, contatos (incluindo não-usuários), foto de perfil, IP, modelo do dispositivo, rede móvel, dados de localização e informações de pagamento — compartilhados em grande parte com o resto da Meta.<S ids={[1, 2, 3]} /></li>
        <li><strong>4.</strong> A criptografia de ponta a ponta protege o <em>conteúdo</em>. Ela não esconde com quem você fala, quando, com que frequência ou de onde.<S ids={[1, 2, 17, 45]} /></li>
        <li><strong>5.</strong> Backups em nuvem (Google Drive, iCloud) <em>não</em> são criptografados de ponta a ponta por padrão.<S ids={[8, 9, 10]} /></li>
        <li><strong>6.</strong> Em 16 de junho de 2025, a Meta anunciou anúncios dentro do WhatsApp, na aba Atualizações.<S ids={[11, 12, 13]} /></li>
        <li><strong>7.</strong> A DPC irlandesa multou o WhatsApp em €225 milhões em 2021. O CCI da Índia multou a Meta em ₹213 crores em 2024.<S ids={[27, 28, 29, 30, 65, 66]} /></li>
        <li><strong>8.</strong> O WhatsApp foi vetor de entrega de pelo menos dois spywares: Pegasus do NSO (júri dos EUA multou NSO em US$167M em 2025) e Graphite da Paragon (2025).<S ids={[18, 19, 20, 23, 24, 25, 26]} /></li>
        <li><strong>9.</strong> Em novembro de 2022, 487 milhões de números de telefone do WhatsApp de 84 países foram colocados à venda em fórum de hackers.<S ids={[59, 60]} /></li>
        <li><strong>10.</strong> O Brasil bloqueou o WhatsApp pelos tribunais ao menos quatro vezes. A China bloqueia completamente.<S ids={[33, 62, 63, 64, 93, 94, 95]} /></li>
        <li><strong>11.</strong> A desinformação pelo WhatsApp desencadeou uma onda de linchamentos na Índia em 2017–2018.<S ids={[67, 68, 69, 70]} /></li>
        <li><strong>12.</strong> O recurso "Ver uma vez" foi burlado por pesquisadores independentes quatro vezes separadas.<S ids={[85, 86, 87]} /></li>
      </ul>
      <H2 id="owners">1. Quem realmente é dono do WhatsApp</H2>
      <P>O WhatsApp foi adquirido pelo Facebook por US$19 bilhões em fevereiro de 2014.<S ids={[51]} /> A empresa-mãe foi renomeada Meta Platforms, Inc. em outubro de 2021.<S ids={[52]} /> O WhatsApp opera como uma subsidiária totalmente controlada — seus servidores, dados e código-fonte pertencem à Meta.</P>
      <H2 id="founders">2. Os próprios fundadores saíram em protesto</H2>
      <P>Brian Acton abandonou cerca de US$850 milhões em ações ao sair da Meta em 2018 para co-fundar a Signal Foundation. Ele twittou publicamente <em>"#deletefacebook"</em>.<S ids={[54, 55]} /> Jan Koum saiu semanas depois, citando divergências sobre compartilhamento de dados e enfraquecimento da criptografia.<S ids={[56, 57, 58]} /></P>
      <H2 id="policy">3. O que a Política de Privacidade realmente diz</H2>
      <P>A Política de Privacidade do WhatsApp declara explicitamente a coleta de: número de telefone e contatos (incluindo não-usuários), foto de perfil e status, modelo do dispositivo, sistema operacional, identificadores de hardware, endereço IP, rede móvel, dados de uso do app, sinais de localização e informações de pagamento.<S ids={[1, 2, 3]} /> Grande parte disso é compartilhada com o restante do ecossistema Meta para fins de publicidade e segurança.</P>
      <H2 id="metadata">4. Metadados — o que a criptografia não esconde</H2>
      <P>A criptografia de ponta a ponta protege o conteúdo das mensagens, mas o WhatsApp ainda sabe: com quem você se comunica e com que frequência, quando as mensagens são enviadas e lidas, seu endereço IP (que revela localização aproximada), o modelo e o sistema operacional do seu dispositivo.<S ids={[17, 45]} /> Esse conjunto de metadados pode revelar padrões de relacionamento, saúde e política — mesmo sem nunca ler uma única mensagem.</P>
      <H2 id="y2021">5. A atualização forçada de 2021</H2>
      <P>Em fevereiro de 2021, o WhatsApp alterou sua política de privacidade exigindo que os usuários aceitassem o compartilhamento de dados com a Meta para continuar usando o serviço.<S ids={[4, 5, 6]} /> A reação pública foi massiva — o Telegram e o Signal ganharam dezenas de milhões de novos usuários em dias. A mudança foi suspensa em vários países após investigações regulatórias.<S ids={[7]} /></P>
      <H2 id="backups">6. A brecha dos backups em nuvem</H2>
      <P>Backups do WhatsApp no Google Drive ou iCloud <em>não</em> são cobertos pela criptografia de ponta a ponta por padrão.<S ids={[8, 9]} /> Isso significa que o Google ou a Apple podem ter acesso a essas mensagens, e que autoridades com uma ordem judicial podem obtê-las diretamente dos servidores de backup. O usuário precisa ativar manualmente o backup E2EE nas configurações.<S ids={[10]} /></P>
      <H2 id="business">7. WhatsApp Business — onde o E2EE termina silenciosamente</H2>
      <P>Quando você envia uma mensagem para uma conta do WhatsApp Business, essa mensagem pode ser processada por provedores de nuvem terceirizados contratados pela empresa — e não é protegida pela criptografia de ponta a ponta padrão.<S ids={[14, 15, 16]} /></P>
      <H2 id="ads">8. Anúncios dentro do WhatsApp (junho 2025)</H2>
      <P>Em 16 de junho de 2025, no Cannes Lions, a Meta anunciou anúncios na aba Atualizações do WhatsApp, canais promovidos e assinaturas pagas.<S ids={[11, 12, 13]} /> Esta é a primeira vez que publicidade comercial entra diretamente no aplicativo de mensagens.</P>
      <H2 id="law">10. Governos e autoridades policiais</H2>
      <P>O WhatsApp responde a solicitações legais de dados de autoridades. Os dados de metadados — número de telefone, tempo de uso, endereço IP — podem ser fornecidos. O conteúdo das mensagens não pode ser fornecido se E2EE estiver ativo, mas os backups em nuvem sem E2EE podem.<S ids={[32, 33, 34, 35]} /></P>
      <H2 id="pegasus">11. Pegasus — veredicto de US$167M do NSO</H2>
      <P>Em maio de 2019, uma falha de buffer overflow no stack VOIP do WhatsApp permitiu que o spyware Pegasus do NSO Group fosse instalado nos dispositivos das vítimas sem qualquer interação do usuário.<S ids={[18, 19, 20]} /> Em maio de 2025, um júri federal dos EUA condenou o NSO Group a pagar US$167 milhões em danos punitivos ao WhatsApp.<S ids={[23, 24, 25, 26]} /></P>
      <H2 id="leak2022">15. O vazamento de 487 milhões de números (2022)</H2>
      <P>Em novembro de 2022, um ator de ameaças anunciou a venda de um banco de dados contendo 487 milhões de números de telefone do WhatsApp de 84 países em um fórum de hackers.<S ids={[59, 60]} /> O Brasil estava entre os países afetados. O WhatsApp negou qualquer violação do sistema, mas os números foram verificados como pertencentes a usuários reais do WhatsApp.</P>
      <H2 id="fines">16. Multas regulatórias</H2>
      <P>€225 milhões (DPC da Irlanda, 2021) pela falha em informar adequadamente os usuários sobre o processamento de dados.<S ids={[27, 28]} /> ₹213 crores — CCI da Índia, 2024, pela atualização de política de 2021.<S ids={[29, 30]} /> Investigações formais foram abertas na Turquia, Alemanha, Itália e outros países da UE.<S ids={[65, 66]} /></P>
      <H2 id="verdict">21. O veredicto para usuários de alta privacidade</H2>
      <Callout tone="danger" title="Conclusão">O WhatsApp não é um serviço de privacidade. É um produto de comunicação de propriedade de uma empresa cuja receita principal vem de publicidade e dados. A criptografia de ponta a ponta é real e protege o conteúdo das mensagens — mas não protege metadados, backups, mensagens empresariais ou as implicações de privacidade de pertencer ao ecossistema Meta.<S ids={[1, 18, 27, 51, 98, 102, 114, 128]} /></Callout>
      <H2 id="signal_vs">33. Signal vs. WhatsApp — o que você realmente perde</H2>
      <P>O Signal coleta apenas seu número de telefone e a data do último login — nada mais.<S ids={[117, 118]} /> Ao contrário do WhatsApp, o Signal não pertence a uma empresa de publicidade, não compartilha dados com terceiros e não requer que seus contatos sejam sincronizados com servidores externos. A única coisa que você "perde" ao mudar para o Signal são os recursos de integração do ecossistema Meta.<S ids={[114, 115, 116]} /></P>
      <H2 id="experts">35. O que especialistas, tribunais e whistleblowers recomendam</H2>
      <P>Edward Snowden, Bruce Schneier, Moxie Marlinspike (criador do Signal) e a Electronic Frontier Foundation recomendam consistentemente o Signal para comunicações sensíveis.<S ids={[128, 129, 130, 131, 132, 133]} /> O Tribunal Federal dos EUA reconheceu o WhatsApp como vítima de vigilância ao emitir um veredicto contra o NSO em 2025.<S ids={[23, 24]} /></P>
    </>
  );
}

/* ─────────────────── INDONESIAN ARTICLE ─────────────────── */
function ArticleId() {
  return (
    <>
      <PrivacyRiskCalculator lang="id" />
      <H2 id="tldr">Ringkasan — apa yang dibuktikan artikel ini</H2>
      <ul className="space-y-3 text-[17px] leading-[1.75] text-[#1f2a24] list-none">
        <li><strong>1.</strong> WhatsApp dimiliki oleh Meta — perusahaan yang sama yang memiliki Facebook, Instagram, Messenger, dan Threads, serta terlibat dalam skandal Cambridge Analytica 2018.<S ids={[51, 52, 53, 61]} /></li>
        <li><strong>2.</strong> Para pendiri WhatsApp sendiri meninggalkan Meta karena masalah data. Brian Acton men-tweet <em>"#deletefacebook"</em> pada 2018, melepaskan saham senilai $850 juta. Jan Koum menyusul beberapa minggu kemudian.<S ids={[54, 55, 56, 57, 58]} /></li>
        <li><strong>3.</strong> Kebijakan Privasi WhatsApp mengonfirmasi pengumpulan nomor telepon, kontak (termasuk bukan pengguna), foto profil, IP, model perangkat, jaringan seluler, sinyal lokasi, dan informasi pembayaran — sebagian besar dibagikan ke ekosistem Meta.<S ids={[1, 2, 3]} /></li>
        <li><strong>4.</strong> Enkripsi ujung ke ujung melindungi <em>konten</em> pesan. Tidak menyembunyikan dengan siapa, kapan, seberapa sering, atau dari mana Anda berkomunikasi.<S ids={[1, 2, 17, 45]} /></li>
        <li><strong>5.</strong> Backup cloud (Google Drive, iCloud) <em>tidak</em> dienkripsi E2EE secara default.<S ids={[8, 9, 10]} /></li>
        <li><strong>6.</strong> Pada 16 Juni 2025, Meta mengumumkan iklan di tab Pembaruan WhatsApp di Cannes Lions.<S ids={[11, 12, 13]} /></li>
        <li><strong>7.</strong> DPC Irlandia mendenda WhatsApp €225 juta pada 2021. CCI India mendenda Meta ₹213 crore pada 2024.<S ids={[27, 28, 29, 30, 65, 66]} /></li>
        <li><strong>8.</strong> WhatsApp menjadi saluran untuk setidaknya dua spyware: Pegasus NSO (juri AS mendenda NSO $167 juta pada 2025) dan Graphite Paragon (2025).<S ids={[18, 19, 20, 23, 24, 25, 26]} /></li>
        <li><strong>9.</strong> Pada November 2022, 487 juta nomor telepon WhatsApp dari 84 negara dijual di forum peretas.<S ids={[59, 60]} /></li>
        <li><strong>10.</strong> Brasil memblokir WhatsApp setidaknya empat kali. Tiongkok memblokir sepenuhnya.<S ids={[33, 62, 63, 64, 93, 94, 95]} /></li>
        <li><strong>11.</strong> Disinformasi WhatsApp memicu gelombang main hakim sendiri di India pada 2017–2018.<S ids={[67, 68, 69, 70]} /></li>
        <li><strong>12.</strong> Fitur "Lihat Sekali" berhasil dibobol oleh peneliti independen sebanyak empat kali.<S ids={[85, 86, 87]} /></li>
      </ul>
      <H2 id="owners">1. Siapa yang benar-benar memiliki WhatsApp</H2>
      <P>WhatsApp diakuisisi oleh Facebook seharga $19 miliar pada Februari 2014.<S ids={[51]} /> Perusahaan induk berganti nama menjadi Meta Platforms, Inc. pada Oktober 2021.<S ids={[52]} /> WhatsApp beroperasi sebagai anak perusahaan yang sepenuhnya dimiliki — server, data, dan kode sumbernya adalah milik Meta.</P>
      <H2 id="policy">3. Apa yang sebenarnya dikatakan Kebijakan Privasi</H2>
      <P>Kebijakan Privasi WhatsApp secara eksplisit menyatakan pengumpulan: nomor telepon dan kontak (termasuk bukan pengguna), foto profil dan status, model perangkat dan sistem operasi, pengidentifikasi perangkat keras, alamat IP, jaringan seluler, data penggunaan aplikasi, sinyal lokasi, dan informasi pembayaran.<S ids={[1, 2, 3]} /> Sebagian besar data ini dibagikan ke seluruh ekosistem Meta untuk tujuan periklanan dan keamanan.</P>
      <H2 id="metadata">4. Metadata — yang tidak disembunyikan enkripsi</H2>
      <P>Enkripsi E2EE melindungi konten pesan, tetapi WhatsApp masih mengetahui: siapa yang Anda ajak berkomunikasi dan seberapa sering, kapan pesan dikirim dan dibaca, alamat IP Anda (mengungkapkan lokasi perkiraan), serta model dan sistem operasi perangkat Anda.<S ids={[17, 45]} /></P>
      <H2 id="y2021">5. Pembaruan paksa 2021</H2>
      <P>Pada Februari 2021, WhatsApp mengubah kebijakan privasinya untuk mewajibkan pengguna menyetujui berbagi data dengan Meta agar dapat terus menggunakan layanan.<S ids={[4, 5, 6]} /> Reaksi publik sangat besar — Telegram dan Signal mendapatkan puluhan juta pengguna baru dalam hitungan hari.<S ids={[7]} /></P>
      <H2 id="pegasus">11. Pegasus — vonis NSO US$167 juta</H2>
      <P>Pada Mei 2019, kerentanan buffer overflow di stack VOIP WhatsApp memungkinkan spyware Pegasus NSO Group dipasang di perangkat korban tanpa interaksi pengguna sama sekali.<S ids={[18, 19, 20]} /> Pada Mei 2025, juri federal AS menghukum NSO Group membayar $167 juta dalam ganti rugi punitif.<S ids={[23, 24, 25, 26]} /></P>
      <H2 id="leak2022">15. Kebocoran 487 juta nomor (2022)</H2>
      <P>Pada November 2022, 487 juta nomor telepon WhatsApp dari 84 negara dijual di forum peretas.<S ids={[59, 60]} /> Indonesia termasuk dalam negara yang terdampak.</P>
      <H2 id="verdict">21. Kesimpulan untuk pengguna yang peduli privasi</H2>
      <Callout tone="danger" title="Kesimpulan">WhatsApp bukan layanan privasi. Ini adalah produk komunikasi milik perusahaan periklanan. Enkripsi E2EE nyata dan melindungi konten pesan — tetapi tidak melindungi metadata, backup, pesan bisnis, atau implikasi privasi dari keberadaan di ekosistem Meta.<S ids={[1, 18, 27, 51, 98, 102, 114, 128]} /></Callout>
      <H2 id="signal_vs">33. Signal vs. WhatsApp — apa yang benar-benar Anda korbankan</H2>
      <P>Signal hanya mengumpulkan nomor telepon Anda dan tanggal login terakhir — tidak ada lagi.<S ids={[117, 118]} /> Tidak seperti WhatsApp, Signal tidak dimiliki oleh perusahaan periklanan dan tidak berbagi data dengan pihak ketiga.<S ids={[114, 115, 116]} /></P>
    </>
  );
}

/* ─────────────────── SPANISH ARTICLE ─────────────────── */
function ArticleEs() {
  return (
    <>
      <PrivacyRiskCalculator lang="es" />
      <H2 id="tldr">En resumen — lo que prueba este artículo</H2>
      <ul className="space-y-3 text-[17px] leading-[1.75] text-[#1f2a24] list-none">
        <li><strong>1.</strong> WhatsApp es propiedad de Meta — la misma empresa que posee Facebook, Instagram, Messenger y Threads, involucrada en el escándalo Cambridge Analytica de 2018.<S ids={[51, 52, 53, 61]} /></li>
        <li><strong>2.</strong> Los propios fundadores de WhatsApp rompieron públicamente con Meta por los datos. Brian Acton tuiteó <em>"#deletefacebook"</em> en 2018, renunciando a $850 millones en acciones. Jan Koum se fue semanas después.<S ids={[54, 55, 56, 57, 58]} /></li>
        <li><strong>3.</strong> La Política de Privacidad de WhatsApp confirma la recopilación de número de teléfono, contactos (incluidos no usuarios), foto de perfil, IP, modelo del dispositivo, red móvil, señales de ubicación e información de pago — compartido en gran parte con el resto de Meta.<S ids={[1, 2, 3]} /></li>
        <li><strong>4.</strong> El cifrado de extremo a extremo protege el <em>contenido</em>. No oculta con quién hablas, cuándo, con qué frecuencia o desde dónde.<S ids={[1, 2, 17, 45]} /></li>
        <li><strong>5.</strong> Las copias de seguridad en la nube (Google Drive, iCloud) <em>no</em> están cifradas de extremo a extremo por defecto.<S ids={[8, 9, 10]} /></li>
        <li><strong>6.</strong> El 16 de junio de 2025, Meta anunció anuncios dentro de WhatsApp, en la pestaña Actualizaciones.<S ids={[11, 12, 13]} /></li>
        <li><strong>7.</strong> La DPC irlandesa multó a WhatsApp con €225 millones en 2021. El CCI de India multó a Meta con ₹213 crores en 2024.<S ids={[27, 28, 29, 30, 65, 66]} /></li>
        <li><strong>8.</strong> WhatsApp fue vector de entrega de al menos dos spywares: Pegasus de NSO (jurado de EE.UU. multó a NSO con $167M en 2025) y Graphite de Paragon (2025).<S ids={[18, 19, 20, 23, 24, 25, 26]} /></li>
        <li><strong>9.</strong> En noviembre de 2022, 487 millones de números de WhatsApp de 84 países se pusieron a la venta en un foro de hackers.<S ids={[59, 60]} /></li>
        <li><strong>10.</strong> Brasil ha bloqueado WhatsApp judicialmente al menos cuatro veces. China lo bloquea por completo.<S ids={[33, 62, 63, 64, 93, 94, 95]} /></li>
        <li><strong>11.</strong> La desinformación por WhatsApp desató una oleada de linchamientos en India en 2017–2018.<S ids={[67, 68, 69, 70]} /></li>
        <li><strong>12.</strong> La función "Ver una vez" fue eludida por investigadores independientes en cuatro ocasiones separadas.<S ids={[85, 86, 87]} /></li>
      </ul>
      <H2 id="owners">1. Quién es el verdadero dueño de WhatsApp</H2>
      <P>WhatsApp fue adquirido por Facebook por $19.000 millones en febrero de 2014.<S ids={[51]} /> La empresa matriz fue renombrada Meta Platforms, Inc. en octubre de 2021.<S ids={[52]} /> WhatsApp opera como una subsidiaria totalmente controlada — sus servidores, datos y código fuente pertenecen a Meta.</P>
      <H2 id="policy">3. Lo que realmente dice la Política de Privacidad</H2>
      <P>La Política de Privacidad de WhatsApp declara explícitamente la recopilación de: número de teléfono y contactos (incluidos no usuarios), foto de perfil y estado, modelo del dispositivo y sistema operativo, identificadores de hardware, dirección IP, red móvil, datos de uso de la app, señales de ubicación e información de pago.<S ids={[1, 2, 3]} /> Gran parte de estos datos se comparte con todo el ecosistema Meta con fines publicitarios y de seguridad.</P>
      <H2 id="metadata">4. Metadatos — lo que el cifrado no oculta</H2>
      <P>El cifrado E2EE protege el contenido de los mensajes, pero WhatsApp todavía sabe: con quién te comunicas y con qué frecuencia, cuándo se envían y leen los mensajes, tu dirección IP (que revela tu ubicación aproximada) y el modelo y sistema operativo de tu dispositivo.<S ids={[17, 45]} /></P>
      <H2 id="y2021">5. La actualización forzada de 2021</H2>
      <P>En febrero de 2021, WhatsApp cambió su política de privacidad exigiendo que los usuarios aceptaran el intercambio de datos con Meta para seguir usando el servicio.<S ids={[4, 5, 6]} /> La reacción pública fue masiva — Telegram y Signal ganaron decenas de millones de usuarios en días.<S ids={[7]} /></P>
      <H2 id="pegasus">11. Pegasus — veredicto de US$167M contra NSO</H2>
      <P>En mayo de 2019, una vulnerabilidad de desbordamiento de búfer en el stack VOIP de WhatsApp permitió que el spyware Pegasus de NSO Group se instalara en los dispositivos de las víctimas sin ninguna interacción del usuario.<S ids={[18, 19, 20]} /> En mayo de 2025, un jurado federal de EE.UU. condenó a NSO Group a pagar $167 millones en daños punitivos.<S ids={[23, 24, 25, 26]} /></P>
      <H2 id="verdict">21. El veredicto para usuarios de alta privacidad</H2>
      <Callout tone="danger" title="Conclusión">WhatsApp no es un servicio de privacidad. Es un producto de comunicación propiedad de una empresa cuya principal fuente de ingresos es la publicidad y los datos. El cifrado E2EE es real y protege el contenido — pero no protege los metadatos, las copias de seguridad, los mensajes empresariales ni las implicaciones de privacidad de pertenecer al ecosistema Meta.<S ids={[1, 18, 27, 51, 98, 102, 114, 128]} /></Callout>
      <H2 id="signal_vs">33. Signal vs. WhatsApp — lo que realmente pierdes</H2>
      <P>Signal solo recoge tu número de teléfono y la fecha de tu último inicio de sesión — nada más.<S ids={[117, 118]} /> A diferencia de WhatsApp, Signal no pertenece a una empresa publicitaria y no comparte datos con terceros.<S ids={[114, 115, 116]} /></P>
    </>
  );
}

/* ─────────────────── RUSSIAN ARTICLE ─────────────────── */
function ArticleRu() {
  return (
    <>
      <PrivacyRiskCalculator lang="ru" />
      <H2 id="tldr">Коротко — что доказывает эта статья</H2>
      <ul className="space-y-3 text-[17px] leading-[1.75] text-[#1f2a24] list-none">
        <li><strong>1.</strong> WhatsApp принадлежит Meta — той самой компании, которой принадлежат Facebook, Instagram, Messenger и Threads, а также компании, причастной к скандалу Cambridge Analytica 2018 года.<S ids={[51, 52, 53, 61]} /></li>
        <li><strong>2.</strong> Основатели WhatsApp публично разорвали отношения с Meta из-за данных. Брайан Актон написал в твиттере <em>"#deletefacebook"</em> в 2018 году, отказавшись от акций на $850 млн. Ян Кум ушёл несколько недель спустя.<S ids={[54, 55, 56, 57, 58]} /></li>
        <li><strong>3.</strong> Политика конфиденциальности WhatsApp подтверждает сбор: номера телефона, контактов (включая не-пользователей), фото профиля, IP-адреса, модели устройства, мобильной сети, сигналов местоположения и платёжной информации — большая часть передаётся в экосистему Meta.<S ids={[1, 2, 3]} /></li>
        <li><strong>4.</strong> Сквозное шифрование защищает <em>содержимое</em> сообщений. Оно не скрывает: с кем вы общаетесь, когда, как часто и откуда.<S ids={[1, 2, 17, 45]} /></li>
        <li><strong>5.</strong> Резервные копии в облаке (Google Drive, iCloud) <em>не</em> зашифрованы сквозным шифрованием по умолчанию.<S ids={[8, 9, 10]} /></li>
        <li><strong>6.</strong> 16 июня 2025 года Meta объявила о запуске рекламы во вкладке «Обновления» WhatsApp.<S ids={[11, 12, 13]} /></li>
        <li><strong>7.</strong> Ирландский DPC оштрафовал WhatsApp на €225 млн в 2021 году. Индийский CCI оштрафовал Meta на ₹213 крор в 2024 году.<S ids={[27, 28, 29, 30, 65, 66]} /></li>
        <li><strong>8.</strong> WhatsApp стал вектором доставки минимум двух шпионских программ: Pegasus от NSO (американское жюри оштрафовало NSO на $167 млн в 2025 году) и Graphite от Paragon (2025).<S ids={[18, 19, 20, 23, 24, 25, 26]} /></li>
        <li><strong>9.</strong> В ноябре 2022 года 487 млн номеров WhatsApp из 84 стран были выставлены на продажу на хакерском форуме.<S ids={[59, 60]} /></li>
        <li><strong>10.</strong> Бразилия блокировала WhatsApp по решению суда не менее четырёх раз. Китай полностью блокирует приложение.<S ids={[33, 62, 63, 64, 93, 94, 95]} /></li>
        <li><strong>11.</strong> Дезинформация через WhatsApp спровоцировала волну самосудов в Индии в 2017–2018 годах.<S ids={[67, 68, 69, 70]} /></li>
        <li><strong>12.</strong> Функция «Посмотреть один раз» была обойдена независимыми исследователями четыре отдельных раза.<S ids={[85, 86, 87]} /></li>
      </ul>
      <H2 id="owners">1. Кто на самом деле владеет WhatsApp</H2>
      <P>WhatsApp был приобретён Facebook за $19 млрд в феврале 2014 года.<S ids={[51]} /> Материнская компания была переименована в Meta Platforms, Inc. в октябре 2021 года.<S ids={[52]} /> WhatsApp работает как полностью подконтрольная дочерняя компания — её серверы, данные и исходный код принадлежат Meta.</P>
      <H2 id="policy">3. Что на самом деле говорит Политика конфиденциальности</H2>
      <P>Политика конфиденциальности WhatsApp прямо указывает на сбор: номера телефона и контактов (включая не-пользователей), фото профиля и статуса, модели устройства и операционной системы, аппаратных идентификаторов, IP-адреса, мобильной сети, данных использования приложения, сигналов местоположения и платёжной информации.<S ids={[1, 2, 3]} /> Большая часть этих данных передаётся в экосистему Meta в рекламных и охранных целях.</P>
      <H2 id="metadata">4. Метаданные — что не скрывает шифрование</H2>
      <P>Сквозное шифрование защищает содержимое сообщений, но WhatsApp по-прежнему знает: с кем и как часто вы общаетесь, когда сообщения отправляются и читаются, ваш IP-адрес (раскрывает приблизительное местоположение), модель и операционную систему вашего устройства.<S ids={[17, 45]} /></P>
      <H2 id="pegasus">11. Pegasus — приговор NSO на $167 млн</H2>
      <P>В мае 2019 года уязвимость переполнения буфера в стеке VOIP WhatsApp позволила шпионскому ПО Pegasus от NSO Group устанавливаться на устройства жертв без какого-либо взаимодействия с пользователем.<S ids={[18, 19, 20]} /> В мае 2025 года федеральное жюри США присудило NSO Group выплатить $167 млн в качестве штрафных санкций.<S ids={[23, 24, 25, 26]} /></P>
      <H2 id="verdict">21. Вывод для пользователей, заботящихся о конфиденциальности</H2>
      <Callout tone="danger" title="Вывод">WhatsApp — не сервис конфиденциальности. Это коммуникационный продукт, принадлежащий рекламной компании. Сквозное шифрование реально и защищает содержимое сообщений — но не защищает метаданные, резервные копии, бизнес-переписку и не устраняет риски конфиденциальности, связанные с нахождением в экосистеме Meta.<S ids={[1, 18, 27, 51, 98, 102, 114, 128]} /></Callout>
      <H2 id="signal_vs">33. Signal против WhatsApp — что вы реально теряете</H2>
      <P>Signal собирает только ваш номер телефона и дату последнего входа — и ничего больше.<S ids={[117, 118]} /> В отличие от WhatsApp, Signal не принадлежит рекламной компании и не передаёт данные третьим лицам.<S ids={[114, 115, 116]} /></P>
    </>
  );
}

/* ─────────────────── GERMAN ARTICLE ─────────────────── */
function ArticleDe() {
  return (
    <>
      <PrivacyRiskCalculator lang="de" />
      <H2 id="tldr">Kurz zusammengefasst — was dieser Artikel beweist</H2>
      <ul className="space-y-3 text-[17px] leading-[1.75] text-[#1f2a24] list-none">
        <li><strong>1.</strong> WhatsApp gehört Meta — demselben Unternehmen, dem Facebook, Instagram, Messenger und Threads gehören, und das in den Cambridge-Analytica-Skandal 2018 verwickelt war.<S ids={[51, 52, 53, 61]} /></li>
        <li><strong>2.</strong> Die eigenen Gründer von WhatsApp brachen öffentlich mit Meta über Datenfragen. Brian Acton twitterte 2018 <em>"#deletefacebook"</em> und verzichtete auf Aktien im Wert von 850 Mio. $. Jan Koum verließ das Unternehmen wenige Wochen später.<S ids={[54, 55, 56, 57, 58]} /></li>
        <li><strong>3.</strong> Die Datenschutzrichtlinie von WhatsApp bestätigt die Erfassung von: Telefonnummer, Kontakten (einschl. Nicht-Nutzern), Profilfoto, IP-Adresse, Gerätemodell, Mobilnetz, Standortsignalen und Zahlungsinformationen — ein Großteil davon wird mit dem Meta-Ökosystem geteilt.<S ids={[1, 2, 3]} /></li>
        <li><strong>4.</strong> Ende-zu-Ende-Verschlüsselung schützt den <em>Inhalt</em> der Nachrichten. Sie verbirgt nicht: mit wem, wann, wie oft oder von wo aus Sie kommunizieren.<S ids={[1, 2, 17, 45]} /></li>
        <li><strong>5.</strong> Cloud-Backups (Google Drive, iCloud) sind standardmäßig <em>nicht</em> Ende-zu-Ende-verschlüsselt.<S ids={[8, 9, 10]} /></li>
        <li><strong>6.</strong> Am 16. Juni 2025 kündigte Meta Werbung im WhatsApp-Tab „Neuigkeiten" an.<S ids={[11, 12, 13]} /></li>
        <li><strong>7.</strong> Die irische DPC verhängte 2021 ein Bußgeld von 225 Mio. € gegen WhatsApp. Das indische CCI verhängte 2024 ein Bußgeld von ₹213 Crore gegen Meta.<S ids={[27, 28, 29, 30, 65, 66]} /></li>
        <li><strong>8.</strong> WhatsApp war Einfallstor für mindestens zwei Spyware-Produkte: Pegasus von NSO (US-Jury verurteilte NSO 2025 zu 167 Mio. $) und Graphite von Paragon (2025, Journalisten in Italien).<S ids={[18, 19, 20, 23, 24, 25, 26]} /></li>
        <li><strong>9.</strong> Im November 2022 wurden 487 Millionen WhatsApp-Nummern aus 84 Ländern in einem Hackerforum zum Kauf angeboten.<S ids={[59, 60]} /></li>
        <li><strong>10.</strong> Brasilien hat WhatsApp mindestens viermal per Gerichtsbeschluss gesperrt. China sperrt es vollständig.<S ids={[33, 62, 63, 64, 93, 94, 95]} /></li>
        <li><strong>11.</strong> WhatsApp-Desinformation löste 2017–2018 eine Welle von Lynchmorden in Indien aus.<S ids={[67, 68, 69, 70]} /></li>
        <li><strong>12.</strong> Die Funktion „Einmal anzeigen" wurde von unabhängigen Forschern viermal umgangen.<S ids={[85, 86, 87]} /></li>
      </ul>
      <H2 id="owners">1. Wem WhatsApp wirklich gehört</H2>
      <P>WhatsApp wurde im Februar 2014 für 19 Mrd. $ von Facebook übernommen.<S ids={[51]} /> Das Mutterunternehmen wurde im Oktober 2021 in Meta Platforms, Inc. umbenannt.<S ids={[52]} /> WhatsApp ist eine vollständig kontrollierte Tochtergesellschaft — Server, Daten und Quellcode gehören Meta.</P>
      <H2 id="policy">3. Was die Datenschutzrichtlinie wirklich sagt</H2>
      <P>Die Datenschutzrichtlinie von WhatsApp nennt explizit folgende Daten: Telefonnummer und Kontakte (auch Nicht-Nutzer), Profilfoto und Status, Gerätemodell und Betriebssystem, Hardware-Kennungen, IP-Adresse, Mobilnetz, App-Nutzungsdaten, Standortsignale und Zahlungsinformationen.<S ids={[1, 2, 3]} /> Ein Großteil dieser Daten wird für Werbe- und Sicherheitszwecke im gesamten Meta-Ökosystem geteilt.</P>
      <H2 id="metadata">4. Metadaten — was die Verschlüsselung nicht verbirgt</H2>
      <P>Ende-zu-Ende-Verschlüsselung schützt den Nachrichteninhalt, aber WhatsApp weiß dennoch: mit wem und wie oft Sie kommunizieren, wann Nachrichten gesendet und gelesen werden, Ihre IP-Adresse (die Ihren ungefähren Standort preisgibt) und Modell sowie Betriebssystem Ihres Geräts.<S ids={[17, 45]} /></P>
      <H2 id="pegasus">11. Pegasus — das NSO-Urteil über 167 Mio. $</H2>
      <P>Im Mai 2019 ermöglichte eine Pufferüberlauf-Schwachstelle im VOIP-Stack von WhatsApp die Installation der Pegasus-Spyware von NSO Group auf Zielgeräten, ohne jegliche Nutzerinteraktion.<S ids={[18, 19, 20]} /> Im Mai 2025 verurteilte ein US-Bundesgericht NSO Group zur Zahlung von 167 Mio. $ an Strafschadenersatz.<S ids={[23, 24, 25, 26]} /></P>
      <H2 id="verdict">21. Das Fazit für Nutzer mit hohem Datenschutzbedarf</H2>
      <Callout tone="danger" title="Fazit">WhatsApp ist kein Datenschutzdienst. Es ist ein Kommunikationsprodukt eines Unternehmens, dessen Haupteinnahmequelle Werbung und Daten sind. E2EE ist real und schützt Nachrichteninhalte — aber nicht Metadaten, Backups, Geschäftsnachrichten oder die Datenschutzimplikationen des Meta-Ökosystems.<S ids={[1, 18, 27, 51, 98, 102, 114, 128]} /></Callout>
      <H2 id="signal_vs">33. Signal vs. WhatsApp — was Sie wirklich aufgeben</H2>
      <P>Signal erfasst nur Ihre Telefonnummer und das Datum Ihres letzten Logins — mehr nicht.<S ids={[117, 118]} /> Im Gegensatz zu WhatsApp gehört Signal keinem Werbeunternehmen und gibt keine Daten an Dritte weiter.<S ids={[114, 115, 116]} /></P>
    </>
  );
}

/* ─────────────────── ITALIAN ARTICLE ─────────────────── */
function ArticleIt() {
  return (
    <>
      <PrivacyRiskCalculator lang="it" />
      <H2 id="tldr">In sintesi — cosa prova questo articolo</H2>
      <ul className="space-y-3 text-[17px] leading-[1.75] text-[#1f2a24] list-none">
        <li><strong>1.</strong> WhatsApp è di proprietà di Meta — la stessa azienda che possiede Facebook, Instagram, Messenger e Threads, e quella coinvolta nello scandalo Cambridge Analytica del 2018.<S ids={[51, 52, 53, 61]} /></li>
        <li><strong>2.</strong> Gli stessi fondatori di WhatsApp hanno pubblicamente rotto con Meta per questioni di dati. Brian Acton ha twittato <em>"#deletefacebook"</em> nel 2018, rinunciando a $850 milioni in azioni. Jan Koum se n'è andato poche settimane dopo.<S ids={[54, 55, 56, 57, 58]} /></li>
        <li><strong>3.</strong> L'Informativa sulla privacy di WhatsApp conferma la raccolta di: numero di telefono, contatti (inclusi non utenti), foto profilo, IP, modello del dispositivo, rete mobile, segnali di posizione e informazioni di pagamento — gran parte condiviso con il resto di Meta.<S ids={[1, 2, 3]} /></li>
        <li><strong>4.</strong> La crittografia end-to-end protegge il <em>contenuto</em> dei messaggi. Non nasconde: con chi parli, quando, con quale frequenza o da dove.<S ids={[1, 2, 17, 45]} /></li>
        <li><strong>5.</strong> I backup cloud (Google Drive, iCloud) <em>non</em> sono crittografati E2EE per impostazione predefinita.<S ids={[8, 9, 10]} /></li>
        <li><strong>6.</strong> Il 16 giugno 2025, Meta ha annunciato pubblicità nella scheda Aggiornamenti di WhatsApp.<S ids={[11, 12, 13]} /></li>
        <li><strong>7.</strong> Il DPC irlandese ha multato WhatsApp per €225 milioni nel 2021. Il CCI indiano ha multato Meta per ₹213 crore nel 2024.<S ids={[27, 28, 29, 30, 65, 66]} /></li>
        <li><strong>8.</strong> WhatsApp è stato vettore di consegna di almeno due spyware: Pegasus di NSO (giuria USA ha condannato NSO a $167M nel 2025) e Graphite di Paragon (2025, giornalisti in Italia).<S ids={[18, 19, 20, 23, 24, 25, 26]} /></li>
        <li><strong>9.</strong> Nel novembre 2022, 487 milioni di numeri WhatsApp di 84 paesi sono stati messi in vendita su un forum di hacker.<S ids={[59, 60]} /></li>
        <li><strong>10.</strong> Il Brasile ha bloccato WhatsApp per ordine del tribunale almeno quattro volte. La Cina lo blocca completamente.<S ids={[33, 62, 63, 64, 93, 94, 95]} /></li>
        <li><strong>11.</strong> La disinformazione su WhatsApp ha scatenato un'ondata di linciaggi in India nel 2017–2018.<S ids={[67, 68, 69, 70]} /></li>
        <li><strong>12.</strong> La funzione "Visualizza una volta" è stata aggirata da ricercatori indipendenti quattro volte separate.<S ids={[85, 86, 87]} /></li>
      </ul>
      <H2 id="owners">1. Chi è il vero proprietario di WhatsApp</H2>
      <P>WhatsApp è stato acquisito da Facebook per $19 miliardi nel febbraio 2014.<S ids={[51]} /> La società madre è stata rinominata Meta Platforms, Inc. nell'ottobre 2021.<S ids={[52]} /> WhatsApp opera come una sussidiaria interamente controllata — i suoi server, dati e codice sorgente appartengono a Meta.</P>
      <H2 id="policy">3. Cosa dice davvero l'Informativa sulla privacy</H2>
      <P>L'Informativa sulla privacy di WhatsApp dichiara esplicitamente la raccolta di: numero di telefono e contatti (inclusi non utenti), foto profilo e stato, modello del dispositivo e sistema operativo, identificatori hardware, indirizzo IP, rete mobile, dati di utilizzo dell'app, segnali di posizione e informazioni di pagamento.<S ids={[1, 2, 3]} /> Gran parte di questi dati è condivisa con tutto l'ecosistema Meta a fini pubblicitari e di sicurezza.</P>
      <H2 id="metadata">4. Metadati — ciò che la crittografia non nasconde</H2>
      <P>La crittografia E2EE protegge il contenuto dei messaggi, ma WhatsApp sa ancora: con chi e quanto spesso comunichi, quando i messaggi vengono inviati e letti, il tuo indirizzo IP (che rivela la tua posizione approssimativa) e il modello e il sistema operativo del tuo dispositivo.<S ids={[17, 45]} /></P>
      <H2 id="paragon">13. Paragon Graphite (2025) — giornalisti italiani nel mirino</H2>
      <P>Nel febbraio 2025, il Citizen Lab e Meta hanno confermato che il sistema spyware Graphite di Paragon Solutions era stato utilizzato per prendere di mira giornalisti e attivisti attraverso WhatsApp in Italia.<S ids={[25, 26]} /> Il governo italiano ha avviato indagini. Questo episodio è di particolare rilevanza per gli utenti italiani: le vittime sono state prese di mira attraverso un'app che milioni di persone usano quotidianamente.</P>
      <H2 id="verdict">21. Il verdetto per gli utenti attenti alla privacy</H2>
      <Callout tone="danger" title="Verdetto">WhatsApp non è un servizio di privacy. È un prodotto di comunicazione di proprietà di un'azienda la cui principale fonte di entrate è la pubblicità e i dati. La crittografia E2EE è reale e protegge il contenuto dei messaggi — ma non protegge i metadati, i backup, i messaggi aziendali o le implicazioni sulla privacy dell'appartenenza all'ecosistema Meta.<S ids={[1, 18, 27, 51, 98, 102, 114, 128]} /></Callout>
      <H2 id="signal_vs">33. Signal vs. WhatsApp — cosa perdi davvero</H2>
      <P>Signal raccoglie solo il tuo numero di telefono e la data dell'ultimo accesso — nient'altro.<S ids={[117, 118]} /> A differenza di WhatsApp, Signal non appartiene a un'azienda pubblicitaria e non condivide dati con terze parti.<S ids={[114, 115, 116]} /></P>
    </>
  );
}

/* ─────────────────── ARABIC ARTICLE (RTL) ─────────────────── */
function ArticleAr() {
  return (
    <div dir="rtl" lang="ar">
      <PrivacyRiskCalculator lang="ar" />
      <H2 id="tldr">باختصار — ما الذي يُثبته هذا المقال</H2>
      <ul className="space-y-3 text-[17px] leading-[1.75] text-[#1f2a24] list-none">
        <li><strong>١.</strong> واتساب مملوك لشركة ميتا — الشركة ذاتها التي تمتلك فيسبوك وإنستغرام وماسنجر وثريدز، والشركة المتورطة في فضيحة كامبريدج أناليتيكا عام 2018.<S ids={[51, 52, 53, 61]} /></li>
        <li><strong>٢.</strong> مؤسسو واتساب أنفسهم انفصلوا عن ميتا بسبب خلافات على البيانات. كتب برايان آكتون تغريدة <em>"#deletefacebook"</em> عام 2018، متخلياً عن أسهم بقيمة 850 مليون دولار. غادر يان كوم بعد أسابيع قليلة.<S ids={[54, 55, 56, 57, 58]} /></li>
        <li><strong>٣.</strong> تؤكد سياسة خصوصية واتساب جمع: رقم الهاتف، وجهات الاتصال (بمن فيهم غير المستخدمين)، وصورة الملف الشخصي، وعنوان IP، وطراز الجهاز، والشبكة المحمولة، وإشارات الموقع، ومعلومات الدفع — ويُشارك معظمها مع بقية منظومة ميتا.<S ids={[1, 2, 3]} /></li>
        <li><strong>٤.</strong> يحمي التشفير التام بين الطرفين <em>محتوى</em> الرسائل. لكنه لا يُخفي: من تتواصل معهم، ومتى، وكم مرة، ومن أين.<S ids={[1, 2, 17, 45]} /></li>
        <li><strong>٥.</strong> النسخ الاحتياطي السحابي (Google Drive، iCloud) <em>غير</em> مشفر بالتشفير التام بين الطرفين بشكل افتراضي.<S ids={[8, 9, 10]} /></li>
        <li><strong>٦.</strong> في 16 يونيو 2025، أعلنت ميتا عن الإعلانات داخل تبويب التحديثات في واتساب في مهرجان كان.<S ids={[11, 12, 13]} /></li>
        <li><strong>٧.</strong> غرّمت هيئة حماية البيانات الأيرلندية واتساب بـ 225 مليون يورو عام 2021. وغرّمت هيئة المنافسة الهندية CCI ميتا بـ 213 كرور روبية عام 2024.<S ids={[27, 28, 29, 30, 65, 66]} /></li>
        <li><strong>٨.</strong> كان واتساب وسيلة لتوصيل برنامجَي تجسس على الأقل: بيغاسوس من NSO (حكمت هيئة محلفين أمريكية بغرامة 167 مليون دولار ضد NSO في 2025) وغرافيت من Paragon (2025).<S ids={[18, 19, 20, 23, 24, 25, 26]} /></li>
        <li><strong>٩.</strong> في نوفمبر 2022، عُرضت للبيع 487 مليون رقم واتساب من 84 دولة في منتدى قراصنة.<S ids={[59, 60]} /></li>
        <li><strong>١٠.</strong> حجبت البرازيل واتساب بأمر قضائي أربع مرات على الأقل. وتحجبه الصين بشكل كامل.<S ids={[33, 62, 63, 64, 93, 94, 95]} /></li>
        <li><strong>١١.</strong> أشعلت المعلومات المضللة عبر واتساب موجة من عمليات قتل الجماعات في الهند بين عامَي 2017 و2018.<S ids={[67, 68, 69, 70]} /></li>
        <li><strong>١٢.</strong> جرى تجاوز ميزة "عرض مرة واحدة" من قِبل باحثين مستقلين أربع مرات منفصلة.<S ids={[85, 86, 87]} /></li>
      </ul>
      <H2 id="owners">١. من يمتلك واتساب فعلياً</H2>
      <P>استحوذ فيسبوك على واتساب بـ 19 مليار دولار في فبراير 2014.<S ids={[51]} /> أُعيدت تسمية الشركة الأم إلى Meta Platforms, Inc. في أكتوبر 2021.<S ids={[52]} /> يعمل واتساب بوصفه شركة تابعة مملوكة بالكامل — خوادمه وبياناته وكوده المصدري جميعها ملك لميتا.</P>
      <H2 id="policy">٣. ما تقوله سياسة الخصوصية فعلاً</H2>
      <P>تُعلن سياسة خصوصية واتساب صراحةً جمع: رقم الهاتف وجهات الاتصال (بمن فيهم غير المستخدمين)، وصورة الملف الشخصي والحالة، وطراز الجهاز ونظام التشغيل، ومعرّفات الأجهزة، وعنوان IP، والشبكة المحمولة، وبيانات استخدام التطبيق، وإشارات الموقع، ومعلومات الدفع.<S ids={[1, 2, 3]} /> يُشارك جزء كبير من هذه البيانات عبر منظومة ميتا لأغراض إعلانية وأمنية.</P>
      <H2 id="metadata">٤. البيانات الوصفية — ما لا يخفيه التشفير</H2>
      <P>يحمي التشفير E2EE محتوى الرسائل، لكن واتساب يعرف مع ذلك: من تتواصل معهم وكم مرة، ومتى تُرسَل الرسائل وتُقرأ، وعنوان IP الخاص بك (الذي يكشف موقعك التقريبي)، وطراز جهازك ونظام تشغيله.<S ids={[17, 45]} /></P>
      <H2 id="law">١٠. الحكومات وجهات تطبيق القانون</H2>
      <P>تشمل الدول التي قيّدت واتساب أو تحقق معه: الإمارات العربية المتحدة (قيّدت مكالمات VOIP)، والمملكة العربية السعودية (قيّدت مكالمات الفيديو تاريخياً)، وإيران (حظر جزئي). ويستجيب واتساب لطلبات البيانات القانونية، وقد يُفصح عن بيانات وصفية كرقم الهاتف وعنوان IP وأوقات النشاط.<S ids={[32, 33, 34, 35]} /></P>
      <H2 id="pegasus">١١. بيغاسوس — حكم 167 مليون دولار ضد NSO</H2>
      <P>في مايو 2019، أتاحت ثغرة تجاوز سعة المخزن المؤقت في مكدس VOIP الخاص بواتساب تثبيت برنامج التجسس بيغاسوس التابع لمجموعة NSO على أجهزة الضحايا دون أي تفاعل من المستخدم.<S ids={[18, 19, 20]} /> وفي مايو 2025، حكمت هيئة محلفين أمريكية فيدرالية بإلزام مجموعة NSO بدفع 167 مليون دولار كتعويضات عقابية.<S ids={[23, 24, 25, 26]} /></P>
      <H2 id="verdict">٢١. الحكم للمستخدمين الباحثين عن الخصوصية</H2>
      <Callout tone="danger" title="الخلاصة">واتساب ليس خدمة خصوصية. إنه منتج تواصل مملوك لشركة دخلها الأساسي من الإعلانات والبيانات. التشفير E2EE حقيقي ويحمي محتوى الرسائل — لكنه لا يحمي البيانات الوصفية، ولا النسخ الاحتياطية، ولا رسائل الأعمال، ولا لا يُلغي مخاطر الخصوصية المترتبة على الانتماء إلى منظومة ميتا.<S ids={[1, 18, 27, 51, 98, 102, 114, 128]} /></Callout>
      <H2 id="signal_vs">٣٣. Signal مقابل واتساب — ما الذي تخسره فعلاً</H2>
      <P>لا يجمع Signal سوى رقم هاتفك وتاريخ آخر تسجيل دخول — لا شيء آخر.<S ids={[117, 118]} /> على خلاف واتساب، لا تملك Signal شركة إعلانية ولا تشارك البيانات مع أطراف ثالثة.<S ids={[114, 115, 116]} /></P>
    </div>
  );
}

/* ─────────────────── TURKISH ARTICLE ─────────────────── */
function ArticleTr() {
  return (
    <>
      <PrivacyRiskCalculator lang="tr" />
      <H2 id="tldr">Özet — bu makale neyi kanıtlıyor</H2>
      <ul className="space-y-3 text-[17px] leading-[1.75] text-[#1f2a24] list-none">
        <li><strong>1.</strong> WhatsApp, Meta'ya aittir — Facebook, Instagram, Messenger ve Threads'in sahibi olan ve 2018 Cambridge Analytica skandalına karışan aynı şirkete.<S ids={[51, 52, 53, 61]} /></li>
        <li><strong>2.</strong> WhatsApp'ın kendi kurucuları veriler konusunda Meta ile kamuoyu önünde tartışarak ayrıldı. Brian Acton 2018'de <em>"#deletefacebook"</em> tweeti atarak yaklaşık 850 milyon dolarlık hissesini geride bıraktı. Jan Koum da birkaç hafta sonra ayrıldı.<S ids={[54, 55, 56, 57, 58]} /></li>
        <li><strong>3.</strong> WhatsApp'ın Gizlilik Politikası; telefon numarası, kişiler (kullanıcı olmayanlar dahil), profil fotoğrafı, IP adresi, cihaz modeli, mobil ağ, konum sinyalleri ve ödeme bilgilerinin toplandığını teyit ediyor — bunların büyük bölümü Meta ekosistemiyle paylaşılıyor.<S ids={[1, 2, 3]} /></li>
        <li><strong>4.</strong> Uçtan uca şifreleme mesaj <em>içeriğini</em> korur. Kiminle, ne zaman, ne sıklıkta veya nereden iletişim kurduğunuzu gizlemez.<S ids={[1, 2, 17, 45]} /></li>
        <li><strong>5.</strong> Bulut yedeklemeleri (Google Drive, iCloud) varsayılan olarak uçtan uca şifreleme ile korunmuyor.<S ids={[8, 9, 10]} /></li>
        <li><strong>6.</strong> 16 Haziran 2025'te Meta, Cannes Lions'ta WhatsApp Güncellemeler sekmesine reklam geleceğini duyurdu.<S ids={[11, 12, 13]} /></li>
        <li><strong>7.</strong> İrlanda DPC 2021'de WhatsApp'a 225 milyon € ceza kesti. Hindistan CCI 2024'te Meta'ya ₹213 crore ceza verdi. Türkiye de 2021'de WhatsApp'ı resmen soruşturdu ve para cezası uyguladı.<S ids={[27, 28, 29, 30, 65, 66]} /></li>
        <li><strong>8.</strong> WhatsApp, en az iki devlet destekli casus yazılımın dağıtım kanalı oldu: NSO'nun Pegasus'u (2025'te ABD jürisi NSO'ya 167 milyon dolar ceza verdi) ve Paragon'un Graphite'i (2025).<S ids={[18, 19, 20, 23, 24, 25, 26]} /></li>
        <li><strong>9.</strong> Kasım 2022'de 84 ülkeden 487 milyon WhatsApp telefon numarası bir hacker forumunda satışa çıkarıldı.<S ids={[59, 60]} /></li>
        <li><strong>10.</strong> Brezilya, WhatsApp'ı mahkeme kararıyla en az dört kez engelledi. Çin ise tamamen engelliyor.<S ids={[33, 62, 63, 64, 93, 94, 95]} /></li>
        <li><strong>11.</strong> WhatsApp üzerinden yayılan dezenformasyon, 2017–2018 yıllarında Hindistan'da bir dizi linç olayını tetikledi.<S ids={[67, 68, 69, 70]} /></li>
        <li><strong>12.</strong> "Bir Kez Görüntüle" özelliği, bağımsız araştırmacılar tarafından dört ayrı kez aşıldı.<S ids={[85, 86, 87]} /></li>
      </ul>
      <H2 id="owners">1. WhatsApp'ı gerçekte kim sahip</H2>
      <P>WhatsApp, Şubat 2014'te Facebook tarafından 19 milyar dolara satın alındı.<S ids={[51]} /> Ana şirket, Ekim 2021'de Meta Platforms, Inc. olarak yeniden adlandırıldı.<S ids={[52]} /> WhatsApp, tamamen kontrolü altında bir yan kuruluş olarak faaliyet gösteriyor — sunucuları, verileri ve kaynak kodu Meta'ya ait.</P>
      <H2 id="policy">3. Gizlilik Politikası gerçekte ne söylüyor</H2>
      <P>WhatsApp'ın Gizlilik Politikası açıkça şunların toplandığını belirtiyor: telefon numarası ve kişiler (kullanıcı olmayanlar dahil), profil fotoğrafı ve durum, cihaz modeli ve işletim sistemi, donanım tanımlayıcıları, IP adresi, mobil ağ, uygulama kullanım verileri, konum sinyalleri ve ödeme bilgileri.<S ids={[1, 2, 3]} /></P>
      <H2 id="y2021">5. 2021'in zorla kabul ettirilen güncellemesi</H2>
      <P>Şubat 2021'de WhatsApp, kullanıcıların hizmeti kullanmaya devam edebilmek için Meta ile veri paylaşımını kabul etmelerini zorunlu kılacak şekilde gizlilik politikasını değiştirdi.<S ids={[4, 5, 6]} /> Türkiye bu güncellemeyi resmi olarak soruşturdu ve WhatsApp'a para cezası uyguladı.<S ids={[65, 66]} /> Kamuoyu tepkisi çok büyük oldu — Telegram ve Signal günler içinde on milyonlarca yeni kullanıcı kazandı.<S ids={[7]} /></P>
      <H2 id="pegasus">11. Pegasus — NSO'ya 167 milyon dolar ceza</H2>
      <P>Mayıs 2019'da WhatsApp'ın VOIP yığınındaki bir arabellek taşması açığı, NSO Group'un Pegasus casus yazılımının kurban cihazlara hiçbir kullanıcı etkileşimi olmadan yüklenmesine olanak tanıdı.<S ids={[18, 19, 20]} /> Mayıs 2025'te bir ABD federal jürisi, NSO Group'u 167 milyon dolar cezai tazminat ödemeye mahkûm etti.<S ids={[23, 24, 25, 26]} /></P>
      <H2 id="verdict">21. Yüksek gizlilik isteyen kullanıcılar için sonuç</H2>
      <Callout tone="danger" title="Sonuç">WhatsApp bir gizlilik hizmeti değildir. Temel gelir kaynağı reklamcılık ve veri olan bir şirkete ait iletişim ürünüdür. E2EE gerçektir ve mesaj içeriklerini korur — ancak meta verileri, yedeklemeleri, iş mesajlarını veya Meta ekosisteminde yer almanın gizlilik üzerindeki etkilerini korumaz.<S ids={[1, 18, 27, 51, 98, 102, 114, 128]} /></Callout>
      <H2 id="signal_vs">33. Signal vs. WhatsApp — gerçekte ne kaybediyorsunuz</H2>
      <P>Signal yalnızca telefon numaranızı ve son giriş tarihinizi topluyor — başka hiçbir şey.<S ids={[117, 118]} /> WhatsApp'ın aksine Signal, bir reklam şirketine ait değil ve üçüncü taraflarla veri paylaşmıyor.<S ids={[114, 115, 116]} /></P>
    </>
  );
}

/* ─────────────────── FRENCH ARTICLE ─────────────────── */
function ArticleFr() {
  return (
    <>
      <PrivacyRiskCalculator lang="fr" />
      <H2 id="tldr">En résumé — ce que prouve cet article</H2>
      <ul className="space-y-3 text-[17px] leading-[1.75] text-[#1f2a24] list-none">
        <li><strong>1.</strong> WhatsApp appartient à Meta — la même entreprise qui possède Facebook, Instagram, Messenger et Threads, impliquée dans le scandale Cambridge Analytica de 2018.<S ids={[51, 52, 53, 61]} /></li>
        <li><strong>2.</strong> Les fondateurs eux-mêmes ont rompu publiquement avec Meta pour des raisons de données. Brian Acton a tweeté <em>"#deletefacebook"</em> en 2018, renonçant à 850 millions de dollars d'actions. Jan Koum est parti quelques semaines après.<S ids={[54, 55, 56, 57, 58]} /></li>
        <li><strong>3.</strong> La Politique de confidentialité de WhatsApp confirme la collecte de : numéro de téléphone, contacts (y compris les non-utilisateurs), photo de profil, IP, modèle d'appareil, réseau mobile, signaux de localisation et informations de paiement — en grande partie partagés avec le reste de Meta.<S ids={[1, 2, 3]} /></li>
        <li><strong>4.</strong> Le chiffrement de bout en bout protège le <em>contenu</em> des messages. Il ne cache pas : avec qui vous parlez, quand, à quelle fréquence ou d'où.<S ids={[1, 2, 17, 45]} /></li>
        <li><strong>5.</strong> Les sauvegardes cloud (Google Drive, iCloud) ne sont <em>pas</em> chiffrées de bout en bout par défaut.<S ids={[8, 9, 10]} /></li>
        <li><strong>6.</strong> Le 16 juin 2025, Meta a annoncé des publicités dans l'onglet Mises à jour de WhatsApp, à Cannes Lions.<S ids={[11, 12, 13]} /></li>
        <li><strong>7.</strong> La DPC irlandaise a condamné WhatsApp à une amende de 225 millions d'euros en 2021. Le CCI indien a condamné Meta à une amende de ₹213 crores en 2024.<S ids={[27, 28, 29, 30, 65, 66]} /></li>
        <li><strong>8.</strong> WhatsApp a été le vecteur d'au moins deux logiciels espions : Pegasus de NSO (jury américain a condamné NSO à 167M$ en 2025) et Graphite de Paragon (2025).<S ids={[18, 19, 20, 23, 24, 25, 26]} /></li>
        <li><strong>9.</strong> En novembre 2022, 487 millions de numéros WhatsApp de 84 pays ont été mis en vente sur un forum de hackers.<S ids={[59, 60]} /></li>
        <li><strong>10.</strong> Le Brésil a bloqué WhatsApp par décision judiciaire au moins quatre fois. La Chine le bloque entièrement.<S ids={[33, 62, 63, 64, 93, 94, 95]} /></li>
        <li><strong>11.</strong> La désinformation sur WhatsApp a déclenché une vague de lynchages en Inde en 2017–2018.<S ids={[67, 68, 69, 70]} /></li>
        <li><strong>12.</strong> La fonction « Voir une fois » a été contournée par des chercheurs indépendants à quatre reprises distinctes.<S ids={[85, 86, 87]} /></li>
      </ul>
      <H2 id="owners">1. Qui possède vraiment WhatsApp</H2>
      <P>WhatsApp a été racheté par Facebook pour 19 milliards de dollars en février 2014.<S ids={[51]} /> La société mère a été rebaptisée Meta Platforms, Inc. en octobre 2021.<S ids={[52]} /> WhatsApp fonctionne comme une filiale entièrement contrôlée — ses serveurs, données et code source appartiennent à Meta.</P>
      <H2 id="policy">3. Ce que dit vraiment la Politique de confidentialité</H2>
      <P>La Politique de confidentialité de WhatsApp déclare explicitement la collecte de : numéro de téléphone et contacts (y compris les non-utilisateurs), photo de profil et statut, modèle d'appareil et système d'exploitation, identifiants matériels, adresse IP, réseau mobile, données d'utilisation de l'application, signaux de localisation et informations de paiement.<S ids={[1, 2, 3]} /> Une grande partie de ces données est partagée dans l'ensemble de l'écosystème Meta à des fins publicitaires et sécuritaires.</P>
      <H2 id="metadata">4. Métadonnées — ce que le chiffrement ne cache pas</H2>
      <P>Le chiffrement E2EE protège le contenu des messages, mais WhatsApp sait encore : avec qui et à quelle fréquence vous communiquez, quand les messages sont envoyés et lus, votre adresse IP (qui révèle votre localisation approximative) et le modèle et le système d'exploitation de votre appareil.<S ids={[17, 45]} /></P>
      <H2 id="pegasus">11. Pegasus — le verdict de 167 M$ contre NSO</H2>
      <P>En mai 2019, une vulnérabilité de dépassement de tampon dans la pile VOIP de WhatsApp a permis au logiciel espion Pegasus de NSO Group d'être installé sur les appareils des victimes sans aucune interaction de l'utilisateur.<S ids={[18, 19, 20]} /> En mai 2025, un jury fédéral américain a condamné NSO Group à payer 167 millions de dollars de dommages-intérêts punitifs.<S ids={[23, 24, 25, 26]} /></P>
      <H2 id="verdict">21. Le verdict pour les utilisateurs soucieux de leur vie privée</H2>
      <Callout tone="danger" title="Verdict">WhatsApp n'est pas un service de confidentialité. C'est un produit de communication appartenant à une entreprise dont la principale source de revenus est la publicité et les données. Le chiffrement E2EE est réel et protège le contenu des messages — mais il ne protège pas les métadonnées, les sauvegardes, les messages professionnels ou les implications sur la vie privée d'appartenir à l'écosystème Meta.<S ids={[1, 18, 27, 51, 98, 102, 114, 128]} /></Callout>
      <H2 id="signal_vs">33. Signal vs. WhatsApp — ce que vous perdez vraiment</H2>
      <P>Signal ne collecte que votre numéro de téléphone et la date de votre dernière connexion — rien d'autre.<S ids={[117, 118]} /> Contrairement à WhatsApp, Signal n'appartient pas à une entreprise publicitaire et ne partage pas de données avec des tiers.<S ids={[114, 115, 116]} /></P>
    </>
  );
}

/* ─────────────────── URDU ARTICLE (RTL) ─────────────────── */
function ArticleUr() {
  return (
    <div dir="rtl" lang="ur">
      <PrivacyRiskCalculator lang="ur" />
      <H2 id="tldr">خلاصہ — یہ مضمون کیا ثابت کرتا ہے</H2>
      <ul className="space-y-3 text-[17px] leading-[1.75] text-[#1f2a24] list-none">
        <li><strong>۱.</strong> واٹس ایپ میٹا کی ملکیت ہے — وہی کمپنی جو فیسبک، انسٹاگرام، میسنجر اور تھریڈز چلاتی ہے، اور 2018 کے کیمبرج اینالیٹیکا اسکینڈل میں ملوث رہی ہے۔<S ids={[51, 52, 53, 61]} /></li>
        <li><strong>۲.</strong> واٹس ایپ کے اپنے بانیوں نے ڈیٹا پر میٹا سے اختلاف کرتے ہوئے علیحدگی اختیار کی۔ برائن ایکٹن نے 2018 میں <em>"#deletefacebook"</em> ٹویٹ کیا اور تقریباً 850 ملین ڈالر کے غیر ویسٹڈ اسٹاک سے دستبردار ہوگئے۔ جان کوم چند ہفتوں بعد چلے گئے۔<S ids={[54, 55, 56, 57, 58]} /></li>
        <li><strong>۳.</strong> واٹس ایپ کی پرائیویسی پالیسی صراحت سے تسلیم کرتی ہے کہ وہ آپ کا فون نمبر، رابطے (غیر صارفین سمیت)، پروفائل فوٹو، IP ایڈریس، ڈیوائس ماڈل، موبائل نیٹ ورک، لوکیشن سگنلز اور ادائیگی کی معلومات جمع کرتا ہے — جن کا بڑا حصہ بقیہ میٹا کے ساتھ شیئر کیا جاتا ہے۔<S ids={[1, 2, 3]} /></li>
        <li><strong>۴.</strong> انڈ-ٹو-انڈ انکرپشن پیغام کے <em>مواد</em> کو محفوظ رکھتی ہے۔ یہ نہیں چھپاتی: آپ کس سے، کب، کتنی بار، اور کہاں سے بات کرتے ہیں۔<S ids={[1, 2, 17, 45]} /></li>
        <li><strong>۵.</strong> کلاؤڈ بیک اپ (Google Drive، iCloud) بطور ڈیفالٹ E2EE سے محفوظ <em>نہیں</em> ہوتے۔<S ids={[8, 9, 10]} /></li>
        <li><strong>۶.</strong> 16 جون 2025 کو میٹا نے کان لائنز میں واٹس ایپ کے اپڈیٹس ٹیب میں اشتہارات کا اعلان کیا۔<S ids={[11, 12, 13]} /></li>
        <li><strong>۷.</strong> آئرلینڈ کے DPC نے 2021 میں واٹس ایپ کو 225 ملین یورو جرمانہ کیا۔ بھارت کے CCI نے 2024 میں میٹا کو ₹213 کروڑ جرمانہ کیا۔<S ids={[27, 28, 29, 30, 65, 66]} /></li>
        <li><strong>۸.</strong> واٹس ایپ کم از کم دو اسپائی ویئر کی ترسیل کا ذریعہ بنا: NSO کا پیگاسس (امریکی جیوری نے 2025 میں NSO کو 167 ملین ڈالر جرمانہ کیا) اور Paragon کا Graphite (2025)۔<S ids={[18, 19, 20, 23, 24, 25, 26]} /></li>
        <li><strong>۹.</strong> نومبر 2022 میں 84 ممالک کے 487 ملین واٹس ایپ فون نمبر ایک ہیکر فورم پر فروخت کے لیے پیش کیے گئے۔<S ids={[59, 60]} /></li>
        <li><strong>۱۰.</strong> برازیل نے واٹس ایپ کو عدالتی حکم سے کم از کم چار بار بلاک کیا۔ چین نے اسے مکمل طور پر بلاک کر رکھا ہے۔<S ids={[33, 62, 63, 64, 93, 94, 95]} /></li>
        <li><strong>۱۱.</strong> پاکستان اور بھارت میں واٹس ایپ کے ذریعے پھیلائی گئی جھوٹی خبروں نے 2017–2018 میں ہجومی تشدد کی لہر پیدا کی۔<S ids={[67, 68, 69, 70]} /></li>
        <li><strong>۱۲.</strong> "ایک بار دیکھیں" فیچر کو آزاد محققین نے چار الگ الگ مواقع پر توڑا۔<S ids={[85, 86, 87]} /></li>
      </ul>
      <H2 id="owners">۱. واٹس ایپ کا اصل مالک کون ہے</H2>
      <P>واٹس ایپ کو فروری 2014 میں فیسبک نے 19 ارب ڈالر میں خریدا۔<S ids={[51]} /> پیرنٹ کمپنی کو اکتوبر 2021 میں Meta Platforms, Inc. کا نام دیا گیا۔<S ids={[52]} /> واٹس ایپ ایک مکمل ملکیتی ذیلی کمپنی کے طور پر کام کرتا ہے — اس کے سرورز، ڈیٹا اور سورس کوڈ سب میٹا کے ہیں۔</P>
      <H2 id="policy">۳. پرائیویسی پالیسی اصل میں کیا کہتی ہے</H2>
      <P>واٹس ایپ کی پرائیویسی پالیسی صراحت سے بتاتی ہے کہ وہ جمع کرتا ہے: فون نمبر اور رابطے (غیر صارفین سمیت)، پروفائل فوٹو اور اسٹیٹس، ڈیوائس ماڈل اور آپریٹنگ سسٹم، ہارڈویئر آئیڈنٹیفائرز، IP ایڈریس، موبائل نیٹ ورک، ایپ کے استعمال کا ڈیٹا، لوکیشن سگنلز اور ادائیگی کی معلومات۔<S ids={[1, 2, 3]} /></P>
      <H2 id="metadata">۴. میٹا ڈیٹا — جو انکرپشن چھپا نہیں سکتی</H2>
      <P>E2EE انکرپشن پیغامات کا مواد محفوظ رکھتی ہے، مگر واٹس ایپ پھر بھی جانتا ہے: آپ کس سے اور کتنی بار بات کرتے ہیں، پیغامات کب بھیجے اور پڑھے جاتے ہیں، آپ کا IP ایڈریس (جو تقریباً لوکیشن ظاہر کرتا ہے)، آپ کی ڈیوائس کا ماڈل اور آپریٹنگ سسٹم۔<S ids={[17, 45]} /></P>
      <H2 id="pegasus">۱۱. پیگاسس — 167 ملین ڈالر کا NSO فیصلہ</H2>
      <P>مئی 2019 میں واٹس ایپ کے VOIP اسٹیک میں بفر اوور فلو کی کمزوری نے NSO گروپ کے پیگاسس اسپائی ویئر کو بغیر کسی صارف کی مداخلت کے متاثرین کے آلات پر انسٹال ہونے کا موقع دیا۔<S ids={[18, 19, 20]} /> مئی 2025 میں ایک امریکی وفاقی جیوری نے NSO گروپ کو 167 ملین ڈالر جرمانہ ادا کرنے کا حکم دیا۔<S ids={[23, 24, 25, 26]} /></P>
      <H2 id="verdict">۲۱. اعلی پرائیویسی صارفین کے لیے نتیجہ</H2>
      <Callout tone="danger" title="نتیجہ">واٹس ایپ کوئی پرائیویسی سروس نہیں ہے۔ یہ ایک ایسی کمپنی کی ملکیت کا مواصلاتی پروڈکٹ ہے جس کی آمدنی کا بنیادی ذریعہ اشتہارات اور ڈیٹا ہے۔ E2EE انکرپشن حقیقی ہے اور پیغامات کے مواد کو محفوظ رکھتی ہے — لیکن یہ میٹا ڈیٹا، بیک اپس، بزنس میسجز یا میٹا کے ایکوسسٹم میں ہونے کے پرائیویسی اثرات سے نہیں بچاتی۔<S ids={[1, 18, 27, 51, 98, 102, 114, 128]} /></Callout>
      <H2 id="signal_vs">۳۳. Signal بمقابلہ واٹس ایپ — آپ اصل میں کیا کھوتے ہیں</H2>
      <P>Signal صرف آپ کا فون نمبر اور آخری لاگ ان کی تاریخ جمع کرتا ہے — اس سے زیادہ کچھ نہیں۔<S ids={[117, 118]} /> واٹس ایپ کے برعکس، Signal کسی اشتہاری کمپنی کی ملکیت نہیں اور نہ ہی تیسرے فریق کے ساتھ ڈیٹا شیئر کرتا ہے۔<S ids={[114, 115, 116]} /></P>
    </div>
  );
}

/* ───────────────────────────── PAGE SHELL ───────────────────────────── */

const TOC_MAP: Record<Lang, typeof TOC_EN> = {
  en: TOC_EN, hi: TOC_HI, pt: TOC_PT, id: TOC_ID, es: TOC_ES,
  ru: TOC_RU, de: TOC_DE, it: TOC_IT, ar: TOC_AR, tr: TOC_TR,
  fr: TOC_FR, ur: TOC_UR,
};

const ALL_LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "pt", label: "Português" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "es", label: "Español" },
  { code: "ru", label: "Русский" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "ar", label: "العربية" },
  { code: "tr", label: "Türkçe" },
  { code: "fr", label: "Français" },
  { code: "ur", label: "اردو" },
];

const VALID_LANGS = new Set<string>(ALL_LANGS.map((l) => l.code));

function detectLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem("veil:wa_blog_lang");
    if (saved && VALID_LANGS.has(saved)) return saved as Lang;
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("hi")) return "hi";
    if (nav.startsWith("pt")) return "pt";
    if (nav.startsWith("id") || nav.startsWith("ms")) return "id";
    if (nav.startsWith("es")) return "es";
    if (nav.startsWith("ru")) return "ru";
    if (nav.startsWith("de")) return "de";
    if (nav.startsWith("it")) return "it";
    if (nav.startsWith("ar")) return "ar";
    if (nav.startsWith("tr")) return "tr";
    if (nav.startsWith("fr")) return "fr";
    if (nav.startsWith("ur")) return "ur";
  } catch { /* ignore */ }
  return "en";
}

/* ────────────── Author credit, share & comments ────────────── */

const ZYNTRA_INSTAGRAM = "https://www.instagram.com/zyntra___x/";

function BlogCredit({ lang }: { lang: Lang }) {
  const headline =
    lang === "hi"
      ? "Researcher + Writer = Zyntra Team"
      : "Researcher + Writer = Zyntra Team";
  const sub =
    lang === "hi"
      ? "हर तथ्य की जाँच और इस लंबे लेख का लेखन Zyntra Team ने किया है।"
      : "Every claim was researched and written by the Zyntra Team.";
  const followLabel = lang === "hi" ? "Instagram पर फ़ॉलो करें" : "Follow on Instagram";

  return (
    <section className="mt-16 rounded-3xl border border-[#e2dfd6] bg-white/70 backdrop-blur p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-full grid place-items-center text-white font-semibold text-[18px] shrink-0"
          style={{
            background: "linear-gradient(135deg, #2E6F40 0%, #68BA7F 100%)",
          }}
          aria-hidden
        >
          ZT
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2E6F40]">
            {lang === "hi" ? "क्रेडिट" : "Credit"}
          </div>
          <h3 className="mt-1.5 text-[20px] sm:text-[22px] font-semibold text-[#0F2A18] leading-tight">
            {headline}
          </h3>
          <p className="mt-2 text-[14.5px] text-[#4a5a4f] leading-relaxed">
            {sub}
          </p>
        </div>
        <a
          href={ZYNTRA_INSTAGRAM}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${followLabel} (@zyntra___x)`}
          className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full text-[13.5px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] shrink-0 self-start sm:self-auto"
          style={{
            background:
              "linear-gradient(45deg, #F58529 0%, #DD2A7B 30%, #8134AF 60%, #515BD4 100%)",
          }}
        >
          <InstagramGlyph />
          <span>@zyntra___x</span>
        </a>
      </div>
    </section>
  );
}

function InstagramGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function BlogShare({ lang }: { lang: Lang }) {
  const [copied, setCopied] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const [pageTitle, setPageTitle] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPageUrl(window.location.href);
      setPageTitle(document.title);
    }
  }, []);

  const heading = lang === "hi" ? "इस लेख को शेयर करें" : "Share this article";
  const sub =
    lang === "hi"
      ? "अगर आपको यह जाँच उपयोगी लगी, तो इसे आगे बढ़ाइए — एक और इंसान को असल सच्चाई पता चलेगी।"
      : "If this investigation was useful to you, pass it on — one more person will see the real picture.";

  const shareText =
    lang === "hi"
      ? "WhatsApp और आपकी प्राइवेसी पर एक डॉक्युमेंट्री-स्तर की जाँच — VeilChat ब्लॉग पर पढ़ें:"
      : "A documentary-style investigation into WhatsApp & your privacy — read on the VeilChat blog:";

  const enc = encodeURIComponent;
  const targets = [
    {
      key: "x",
      label: "X",
      url: `https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(pageUrl)}`,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      bg: "#0F0F0F",
      fg: "#FFFFFF",
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      url: `https://wa.me/?text=${enc(`${shareText} ${pageUrl}`)}`,
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.262.489 1.694.625.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.36-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.886 9.884zm8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
        </svg>
      ),
      bg: "#25D366",
      fg: "#FFFFFF",
    },
    {
      key: "telegram",
      label: "Telegram",
      url: `https://t.me/share/url?url=${enc(pageUrl)}&text=${enc(shareText)}`,
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.022c.242-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.643-.204-.658-.643.136-.953l11.566-4.458c.538-.196 1.006.128.832.939z" />
        </svg>
      ),
      bg: "#229ED9",
      fg: "#FFFFFF",
    },
    {
      key: "facebook",
      label: "Facebook",
      url: `https://www.facebook.com/sharer/sharer.php?u=${enc(pageUrl)}`,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      bg: "#1877F2",
      fg: "#FFFFFF",
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(pageUrl)}`,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
      bg: "#0A66C2",
      fg: "#FFFFFF",
    },
  ];

  async function handleNativeShare() {
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: pageTitle,
          text: shareText,
          url: pageUrl,
        });
      } catch {
        /* user cancelled */
      }
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — silently ignore */
    }
  }

  const hasNativeShare =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { share?: unknown }).share === "function";

  return (
    <section className="mt-10 rounded-3xl border border-[#e2dfd6] bg-white/70 backdrop-blur p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#E8F3E5] grid place-items-center text-[#2E6F40] shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[20px] sm:text-[22px] font-semibold text-[#0F2A18] leading-tight">
            {heading}
          </h3>
          <p className="mt-1.5 text-[14.5px] text-[#4a5a4f] leading-relaxed">
            {sub}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {targets.map((t) => (
          <a
            key={t.key}
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${lang === "hi" ? "शेयर:" : "Share to"} ${t.label}`}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-transform hover:scale-[1.03] active:scale-[0.97]"
            style={{ backgroundColor: t.bg, color: t.fg }}
          >
            {t.icon}
            <span>{t.label}</span>
          </a>
        ))}

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-semibold border border-[#0F2A18]/15 bg-white text-[#0F2A18] hover:bg-[#0F2A18]/5 transition-colors"
          aria-live="polite"
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{lang === "hi" ? "कॉपी हो गया" : "Copied!"}</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{lang === "hi" ? "लिंक कॉपी करें" : "Copy link"}</span>
            </>
          )}
        </button>

        {hasNativeShare && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#2E6F40" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span>{lang === "hi" ? "अधिक शेयर विकल्प" : "More…"}</span>
          </button>
        )}
      </div>
    </section>
  );
}

type LocalComment = {
  id: string;
  name: string;
  body: string;
  createdAt: number;
};

const COMMENTS_STORAGE_KEY = "veil:blog:whatsapp-privacy:comments:v1";
const COMMENTS_MAX = 200;

function loadComments(): LocalComment[] {
  try {
    const raw = window.localStorage.getItem(COMMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (c): c is LocalComment =>
          !!c &&
          typeof c === "object" &&
          typeof (c as LocalComment).id === "string" &&
          typeof (c as LocalComment).name === "string" &&
          typeof (c as LocalComment).body === "string" &&
          typeof (c as LocalComment).createdAt === "number",
      )
      .slice(0, COMMENTS_MAX);
  } catch {
    return [];
  }
}

function saveComments(list: LocalComment[]) {
  try {
    window.localStorage.setItem(
      COMMENTS_STORAGE_KEY,
      JSON.stringify(list.slice(0, COMMENTS_MAX)),
    );
  } catch {
    /* quota / privacy mode — silently ignore */
  }
}

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const first = parts[0] ?? "";
    return first.slice(0, 2).toUpperCase() || "?";
  }
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
}

function formatRelative(ts: number, lang: Lang): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return lang === "hi" ? "अभी-अभी" : "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return lang === "hi" ? `${diffMin} मिनट पहले` : `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return lang === "hi" ? `${diffHr} घंटे पहले` : `${diffHr} h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return lang === "hi" ? `${diffDay} दिन पहले` : `${diffDay} d ago`;
  return new Date(ts).toLocaleDateString();
}

function BlogComments({ lang }: { lang: Lang }) {
  const [comments, setComments] = useState<LocalComment[]>([]);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setComments(loadComments());
    try {
      const savedName = window.localStorage.getItem("veil:blog:commenter-name");
      if (savedName) setName(savedName);
    } catch {
      /* ignore */
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim().slice(0, 60);
    const trimmedBody = body.trim().slice(0, 1200);
    if (!trimmedName) {
      setError(lang === "hi" ? "कृपया अपना नाम लिखें।" : "Please enter your name.");
      return;
    }
    if (trimmedBody.length < 2) {
      setError(
        lang === "hi"
          ? "टिप्पणी थोड़ी और लिखिए।"
          : "Your comment is a bit short.",
      );
      return;
    }
    setError(null);
    const next: LocalComment[] = [
      {
        id:
          (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        name: trimmedName,
        body: trimmedBody,
        createdAt: Date.now(),
      },
      ...comments,
    ];
    setComments(next);
    saveComments(next);
    try {
      window.localStorage.setItem("veil:blog:commenter-name", trimmedName);
    } catch {
      /* ignore */
    }
    setBody("");
  }

  function handleDelete(id: string) {
    const next = comments.filter((c) => c.id !== id);
    setComments(next);
    saveComments(next);
  }

  const heading =
    lang === "hi" ? "टिप्पणियाँ और प्रतिक्रियाएँ" : "Comments & reactions";
  const privacyNote =
    lang === "hi"
      ? "गोपनीयता: टिप्पणियाँ केवल आपके अपने ब्राउज़र में सुरक्षित होती हैं। यह कोई सार्वजनिक comment-थ्रेड नहीं है — आपकी टिप्पणी हमारे server पर नहीं भेजी जाती और दूसरे visitors को दिखाई नहीं देगी। यह जानबूझकर ऐसा है — privacy-first।"
      : "Privacy note: comments are saved on your own device only. This isn't a public comment thread — your note is never sent to our servers and won't be visible to other visitors. That's intentional — privacy first.";
  const namePlaceholder = lang === "hi" ? "आपका नाम" : "Your name";
  const bodyPlaceholder =
    lang === "hi"
      ? "इस लेख के बारे में आप क्या सोचते हैं?"
      : "What did you think of this piece?";
  const submitLabel = lang === "hi" ? "टिप्पणी सहेजें" : "Save comment";
  const emptyLabel =
    lang === "hi"
      ? "अभी तक कोई टिप्पणी नहीं — पहले बनिए।"
      : "No notes yet — be the first.";
  const deleteLabel = lang === "hi" ? "हटाएँ" : "Delete";

  return (
    <section className="mt-10 rounded-3xl border border-[#e2dfd6] bg-white/70 backdrop-blur p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#E8F3E5] grid place-items-center text-[#2E6F40] shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[20px] sm:text-[22px] font-semibold text-[#0F2A18] leading-tight">
            {heading}
          </h3>
          <p className="mt-1.5 text-[13px] text-[#4a5a4f] leading-relaxed italic">
            {privacyNote}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={namePlaceholder}
          maxLength={60}
          className="w-full rounded-xl border border-[#0F2A18]/15 bg-white px-4 py-2.5 text-[14.5px] text-[#0F2A18] placeholder:text-[#0F2A18]/40 focus:outline-none focus:ring-2 focus:ring-[#2E6F40]/40 focus:border-[#2E6F40]"
          aria-label={namePlaceholder}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={bodyPlaceholder}
          maxLength={1200}
          rows={4}
          className="w-full rounded-xl border border-[#0F2A18]/15 bg-white px-4 py-3 text-[14.5px] text-[#0F2A18] placeholder:text-[#0F2A18]/40 focus:outline-none focus:ring-2 focus:ring-[#2E6F40]/40 focus:border-[#2E6F40] resize-y min-h-[100px]"
          aria-label={bodyPlaceholder}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12px] text-[#4a5a4f]">
            {body.length}/1200
          </span>
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-[13.5px] font-semibold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#2E6F40" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            <span>{submitLabel}</span>
          </button>
        </div>
        {error && (
          <div className="text-[13px] text-[#B0341A] bg-[#FBE8E2] border border-[#B0341A]/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </form>

      <div className="mt-6 space-y-3">
        {comments.length === 0 ? (
          <div className="text-center text-[13.5px] text-[#4a5a4f] italic py-6 border border-dashed border-[#0F2A18]/15 rounded-xl">
            {emptyLabel}
          </div>
        ) : (
          comments.map((c) => (
            <article
              key={c.id}
              className="rounded-xl border border-[#e2dfd6] bg-white p-4 flex gap-3"
            >
              <div
                className="w-9 h-9 rounded-full grid place-items-center text-white text-[12px] font-semibold shrink-0"
                style={{
                  background: "linear-gradient(135deg, #2E6F40 0%, #68BA7F 100%)",
                }}
                aria-hidden
              >
                {initialsOf(c.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-[14px] font-semibold text-[#0F2A18] truncate">
                      {c.name}
                    </span>
                    <span className="text-[11.5px] text-[#4a5a4f]">
                      · {formatRelative(c.createdAt, lang)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="text-[11.5px] text-[#4a5a4f] hover:text-[#B0341A] transition-colors"
                    aria-label={deleteLabel}
                  >
                    {deleteLabel}
                  </button>
                </div>
                <p className="mt-1 text-[14px] text-[#1f2a24] leading-[1.6] whitespace-pre-wrap break-words">
                  {c.body}
                </p>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export function WhatsappPrivacyPage() {
  const pct = useReadingProgress();
  const [lang, setLang] = useState<Lang>(detectLang);
  const readingMinutes = useMemo(() => (lang === "hi" ? 68 : 75), [lang]);

  useEffect(() => {
    try {
      window.localStorage.setItem("veil:wa_blog_lang", lang);
    } catch { /* ignore */ }
    document.documentElement.setAttribute("lang", lang);
    const isRtl = lang === "ar" || lang === "ur";
    document.documentElement.setAttribute("dir", isRtl ? "rtl" : "ltr");
    return () => { document.documentElement.removeAttribute("dir"); };
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

  const tocItems = TOC_MAP[lang] ?? TOC_EN;

  function renderArticle() {
    switch (lang) {
      case "hi": return <ArticleHindi />;
      case "pt": return <ArticlePt />;
      case "id": return <ArticleId />;
      case "es": return <ArticleEs />;
      case "ru": return <ArticleRu />;
      case "de": return <ArticleDe />;
      case "it": return <ArticleIt />;
      case "ar": return <ArticleAr />;
      case "tr": return <ArticleTr />;
      case "fr": return <ArticleFr />;
      case "ur": return <ArticleUr />;
      default:   return <ArticleEnglish />;
    }
  }

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
          {/* Language selector */}
          <label className="sr-only" htmlFor="lang-select">Choose language</label>
          <select
            id="lang-select"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="rounded-full border border-[#0F2A18]/15 bg-white/70 px-3 py-1.5 text-sm font-medium text-[#0F2A18] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2E6F40]/40"
          >
            {ALL_LANGS.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
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
        {renderArticle()}

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

        <BlogCredit lang={lang} />
        <BlogShare lang={lang} />
        <BlogComments lang={lang} />

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

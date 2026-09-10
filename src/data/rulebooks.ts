/**
 * What each event's official 2026 rulebook actually says.
 *
 * The PDFs in `public/rulebooks` are the source of record and every event links
 * to its own. This file is the part somebody reads *before* deciding to open a
 * forty-page PDF: the four or five lines that change whether you enter.
 *
 * Keep entries short. Anything longer than six bullets belongs in the PDF, and
 * the card links to it right underneath.
 */

import { territories, type Contact } from './events'

export type EventDetail = {
  /** The day it runs, where the rulebook fixes one. */
  date?: string
  /** The rules that change a decision: format, duration, team shape, what's provided. */
  rules: string[]
  /** Coordinators named on that event's rulebook page, where they differ from the vertical's. */
  contacts?: Contact[]
}

const C = (name: string, phone: string): Contact => ({ name, phone })

export const eventDetail: Record<string, EventDetail> = {
  /* ---------------- Chorea (SOLASTA rulebook) ---------------- */

  'Nritya Sangam': {
    rules: [
      'Any Indian classical, folk or regional form. Solo, duet or group.',
      'Groups of 4–22 members.',
      'Time: solo 2–4 min · duet 3–5 min · group 6–10 min. Overrunning costs points.',
      'Bring your own costumes and props. Audio in MP3, submitted 24 hours ahead, with a pen-drive backup.',
      'No fire, confetti or anything that damages the stage.',
    ],
    contacts: [C('Ritika', '9302596114')],
  },
  Ballismus: {
    rules: [
      'Western, Bollywood or fusion. Solo, duet or group.',
      'Groups of 4–22 members.',
      'Time: solo 2–4 min · duet 3–5 min · group 6–10 min.',
      'Audio in MP3, submitted 24 hours ahead. No last-minute audio changes.',
      'Judged on choreography, expression, coordination and stage presence.',
    ],
    contacts: [C('Ritika', '9302596114')],
  },
  'Street Blaze': {
    rules: [
      'Street and urban styles only. Solo, duet or group.',
      'Groups of 4–20 members.',
      'Time: solo 2–4 min · duet 3–5 min · group 5–10 min.',
      'Original choreography is encouraged; copying another entrant’s routine is prohibited.',
      'Spot entries available.',
    ],
    contacts: [C('Ritika', '9302596114')],
  },
  Adaptune: {
    rules: [
      'You dance to a song we pick, revealed on the spot.',
      'One minute to think about the choreography. Each track runs up to a minute.',
      'Up to three chances to accept the song offered.',
      'Enter solo or as a duet.',
    ],
    contacts: [C('Ritika', '9302596114')],
  },

  /* ---------------- Sinfonia (SOLASTA rulebook) ---------------- */

  Tarang: {
    rules: [
      'Indian light, semi-classical, Bollywood or folk. One round; the winner is decided on it.',
      'Time limit 1.5–4 minutes. Overrunning costs points.',
      'Mics, cables, drum kit and keyboard provided. No other instrument is.',
      'Karaoke tracks in MP3, 24 hours ahead, plus a pen-drive backup.',
      'Only vocal quality is judged, never the karaoke or the accompaniment.',
    ],
    contacts: [C('Shivanshi', '9258542725'), C('Raheel', '7086042407')],
  },
  Euphonia: {
    rules: [
      'Western singing. One round; the winner is declared after it.',
      'Instrumentalists or a karaoke track are yours to arrange.',
      'Mics, cables, drum kit and keyboard provided. No other instrument is.',
      'Karaoke tracks in MP3, 24 hours ahead, plus a pen-drive backup.',
      'Spot registrations available.',
    ],
    contacts: [C('Raheel', '7086042407')],
  },
  Metallica: {
    rules: [
      'Any instrument. Perform solo or as a duet.',
      'Mics, cables, drum kit and keyboard provided. Nothing else is.',
      'Judged on technique, precision and sound.',
      'Spot registrations available.',
    ],
    contacts: [C('Raheel', '7086042407')],
  },
  'Battle of Bands': {
    rules: [
      'Online screening first: send a performance video of no more than 5 minutes. Studio, stage or compiled — your call.',
      'Submissions close 2 October 2026. The best bands come to AIIMS Rishikesh for the live final.',
      'The ₹2000 band fee is paid only after you clear the screening round.',
      'Bands of 4–12 members; a maximum of 9 on stage at once.',
      'Any song, any language. 15 minutes on stage, soundcheck included.',
      'Mics, cables, drum kit and keyboard provided. No other instruments.',
    ],
    contacts: [C('Raheel', '7086042407')],
  },
  'Rhythm Revolution': {
    rules: [
      'Rap and beatboxing. Solo or duet.',
      'Each performance is 5 minutes at most.',
      'Backing beat tracks allowed, submitted in MP3 24 hours ahead with a pen-drive backup.',
      'Abusive language is prohibited. Indirect references are tolerated unless highly offensive.',
    ],
    contacts: [C('Raheel', '7086042407')],
  },

  /* ---------------- Thespians (SOLASTA rulebook) ---------------- */

  'Echoes of Expression': {
    rules: [
      'Monoact or mime. A single act, no breaks.',
      'Any genre; credit the writer if the script is adapted.',
      'Ten minutes maximum. Hindi or English, with short passages in other languages permitted.',
      'A second small character, if you need one, is yours to arrange.',
      'Props and a backing track are allowed.',
    ],
    contacts: [C('Shivanshi', '9258542725'), C('Rikki', '9034573823')],
  },
  'mADD Angle': {
    rules: [
      'You are handed a random prop and get one minute to prepare.',
      'Sell it as an advertisement or stage it as drama — either counts.',
      'Five minutes maximum. Hindi or English.',
      'Teams of up to 3. Basic brand products are provided; no other props are.',
      'Judged on creativity, humour, relevance to the prop, audience engagement and presentation.',
    ],
    contacts: [C('Shivanshi', '9258542725'), C('Rikki', '9034573823')],
  },
  'Nukkad Natak': {
    rules: [
      'Teams of 6–20. The limit is hard — no exceptions.',
      'One round. Eighteen minutes maximum; overrunning costs marks.',
      'Hindi or English, in language a passer-by understands.',
      'Original work only. Open theme, but plays with social relevance are expected.',
      'No fire (not even diyas or lighters), no water, no electronic music instruments.',
      'Bring your own props and costumes.',
    ],
    contacts: [C('Shivanshi', '9258542725'), C('Rikki', '9034573823')],
  },

  /* ---------------- Velocity ---------------- */

  Basketball: {
    rules: [
      'FIBA rules. Men’s and women’s categories, in both 5v5 and 3v3.',
      '5v5 squads of up to 10; 3v3 squads of up to 4.',
      'Only UG students and interns may play.',
      'Deposit your college ID at the table before every match.',
      'Fail to field a full side within 15 minutes of the scheduled start and the opponent gets a walkover.',
    ],
    contacts: [C('Pardhuman', '8699305467'), C('Yashwardhan', '9983082339')],
  },
  Volleyball: {
    rules: [
      'FIVB rules as adopted by the All India Volleyball Association, except rotation.',
      'Squads of no more than 12. All players from the same college.',
      'Knockouts of 3 sets to 25; semis and finals are 5 sets, the last to 15.',
      'Proper kit is compulsory: t-shirt, shorts, shoes. Match balls are provided.',
      'Report 30 minutes before the scheduled time.',
    ],
    contacts: [C('Sohit', '7976254062'), C('Kavya', '9257998985'), C('Nishant', '7014289156')],
  },
  Cricket: {
    rules: [
      'Knockout format, 20 overs a side. Rain shortens overs at the organisers’ call.',
      'Squad of 15 (11 + 4 substitutes). The playing XI cannot change once submitted.',
      'No player may turn out for two teams — both are disqualified if they do.',
      'ICC rules apply (LBW excepted). D/L in case of rain.',
      'Field for fewer than 8 overs and you cannot bat or bowl for the rest of the match.',
      'Interns, UG 2022–2026, JRs and SRs are eligible. Contact the organisers before registering to confirm dates and spots.',
    ],
    contacts: [C('Chirag', '7878169955'), C('Saransh', '6377478125'), C('Gaurav', '9610709082')],
  },
  Football: {
    rules: [
      'FIFA rules. Squads of 11–16, with up to 5 substitutions.',
      'Knockouts are 60 minutes (30-5-30); semis and final are 70 (35-5-35).',
      'Ties are settled on penalties; semis and final go to 20 minutes of extra time first.',
      'Only 3 PGs per team, and only 2 in the playing XI.',
      'Full kit compulsory: shirt, shorts, socks, shin-guards and studs. Keepers must be distinguishable.',
    ],
    contacts: [C('Priyanshu', '9560661627'), C('Himanshu', '9728035805')],
  },
  Futsal: {
    rules: [
      'Squads of 5–9 (4 + keeper on the pitch), rolling substitutions.',
      'Knockouts are 30 minutes (15-5-15); semis and final are 40 (20-5-20).',
      'Ties are settled on penalties; semis and final go to 10 minutes of extra time first.',
      'No PGs allowed in the team.',
      'Full kit compulsory, keepers distinguishable.',
    ],
    contacts: [C('Kshitiz', '7209390099')],
  },
  Kabaddi: {
    rules: [
      'Squads of 7–12, up to 5 substitutions. Men’s and women’s categories.',
      'Matches are 40 minutes (20-5-20); ties go to 8 minutes of extra time.',
      'Batch 2021 or later only.',
      'Kabaddi shoes are provided during play and must be returned, or a fine applies.',
      'Insufficient registration can cancel the event; fees are refunded if it does.',
    ],
    contacts: [C('Vijendra', '7597969589'), C('Anjali', '9813073792'), C('Umang', '6207436342')],
  },
  'Table Tennis': {
    rules: [
      'Singles, doubles and mixed doubles. All matches are knockout.',
      'ITTF service and return laws apply, and the umpire rules on service legality.',
      'Bring your own racquet and your college ID.',
      'Report 15 minutes before the scheduled time.',
    ],
    contacts: [C('Rudra', '9429118353'), C('Sarthak', '9773656844')],
  },
  Badminton: {
    rules: [
      'BWF rules, knockout draw. Men’s and women’s singles, men’s, women’s and mixed doubles.',
      'Knockout rounds are one set to 21; quarters are best of three to 15; semis and finals best of three to 21.',
      'Bring your own racquet; shuttlecocks are provided.',
      'Entries are limited and filled first come, first served.',
      'Report 30 minutes early. No refunds, and insufficient registration may cancel a category.',
    ],
    contacts: [C('Ansh', '8209535299'), C('Sharva', '8484857561')],
  },
  Chess: {
    rules: [
      'One team tournament and three individual tournaments. You may enter as many as you like.',
      'Team: four players plus up to two optional substitutes, all from the same college. Double-elimination, 15+0.',
      'Individual time controls — Rapid 10+2, Blitz 5+3, Bullet 2+1. All knockout.',
      'FIDE rules throughout. Batch 2021 or later only.',
      'Carry a valid college ID.',
    ],
    contacts: [C('Ayush', '9798804763'), C('Jayesh', '6375152434')],
  },
  Carrom: {
    rules: [
      'Singles (2 players) and doubles (4 players). Best of three boards.',
      'Strike with fingers only, one touch per turn; the striker must touch both baseline circles.',
      'Pocket the queen and you must cover it in the same or the next shot, or it returns to the centre.',
      'Pocketing the striker returns one of your pocketed coins to the board.',
      'In doubles, partners sit opposite, alternate turns, and may talk.',
    ],
    contacts: [C('Nazmus', '7002349235')],
  },
  Powerlifting: {
    rules: [
      'Squat, bench press and deadlift. Three attempts each; the best successful lift counts.',
      'Total = best squat + best bench + best deadlift, ranked within your weight class.',
      'Weight classes: up to 65.0 kg · 65.1–74.0 · 74.1–83.0 · above 83.0 kg.',
      'Ties go to the lighter lifter.',
      'Open to male participants. Belt, wrist wraps, knee sleeves and chalk are allowed.',
    ],
    contacts: [C('Shivam', '8393953243'), C('Garvit', '8764192552')],
  },

  /* ---------------- Chronos ---------------- */

  'Mr. & Ms. PYREXIA': {
    rules: [
      'Theme: Serenity of Seasons. Dress as spring, summer, autumn or winter — and make the season unmistakable.',
      'Round 1 · Ramp Walk: a 30-second intro video in MP4 (you on camera, not a voiceover) with your name, one word that describes you, and why you chose your outfit. No college or course names. The video plays, then you walk for 40 seconds.',
      'Round 2 · Talent: one talent, two minutes maximum. Bring your own MP3 track and props.',
      'Round 3 · Surprise: revealed on the day at the auditorium. No preparation, no rehearsal.',
    ],
    contacts: [
      C('Ritika', '9302596114'),
      C('Rashi', '8200093641'),
      C('Mudassir', '8861384164'),
      C('Vridhi', '8699155303'),
    ],
  },

  /* ---------------- Littmania ---------------- */

  'Biocrux Jr': {
    rules: [
      'All pre- and para-clinical subjects. Open to MBBS 2023, 2024 and 2025 batches.',
      'Online prelims on Google Forms, 19 September 2026: 30 questions in 15 minutes.',
      'Top 20 teams reach the finale at AIIMS Rishikesh during PYREXIA.',
      'Teams of up to 3. Lone wolves welcome. Inter-college teams permitted.',
      'One entry per team, through the team leader. Join the quiz WhatsApp group — the link follows your submission.',
    ],
    contacts: [C('Raheel Barbarua', '7086042407'), C('Jatin Gupta', '9571602438'), C('Priyansh Aggarwal', '9855545921')],
  },
  'Biocrux Sr': {
    rules: [
      'All relevant clinical knowledge. Open from the MBBS 2025 batch to interns.',
      'Online prelims on Google Forms, 26 September 2026: 30 questions in 15 minutes.',
      'Top 20 teams reach the finale at AIIMS Rishikesh during PYREXIA.',
      'Teams of up to 3, maximum one intern per team. Lone wolves welcome.',
      'One entry per team, through the team leader. Join the quiz WhatsApp group — the link follows your submission.',
    ],
    contacts: [C('Raheel Barbarua', '7086042407'), C('Jatin Gupta', '9571602438'), C('Priyansh Aggarwal', '9855545921')],
  },
  Cognizzia: {
    rules: [
      'Open to all. Teams of 2 or 3; lone wolves welcome.',
      'Four rounds. Round 1 is a pen-and-paper screening that picks 6 teams.',
      'Unanswered questions in the last three rounds go to the audience, who can win prizes for them.',
      'Phones away. Cheating in any form is instant disqualification, as is turning up late.',
      'Top 6 teams get certificates of merit; the top 3 get prizes.',
    ],
    contacts: [C('Jatin Gupta', '9571602438'), C('Priyansh Aggarwal', '9855545921')],
  },
  Cineholics: {
    rules: [
      'Film, web series and OTT. Four rounds.',
      'Round 1 is a pen-and-paper screening; the top 6 teams go through.',
      'Teams of 2 or 3. Lone wolves are paired with other entrants by the organisers.',
      'Expect an informal “two truths and a lie” face-off and a few surprises.',
    ],
    contacts: [C('Priyansh Aggarwal', '9855545921')],
  },
  'Anime no Tatakai': {
    rules: [
      'Four rounds. Trivia (5 pts, 10 seconds a question), picture round (10 pts), audio round (5 pts, −1 for a wrong answer).',
      'Final round: you choose the stake — 5, 10, 15 or 20 points — and lose the same if you’re wrong.',
      'Teams of 2–4; lone wolves allowed. Open from first years to interns.',
      'Mainstream and current series. Little to no manga, manhwa or manhua.',
    ],
    contacts: [C('Yug Bhoi', '9978618124'), C('Aryan', '9103036041')],
  },
  JAM: {
    rules: [
      'Sixty seconds on a topic drawn from a chit, with no hesitation, deviation or repetition.',
      'Two rounds. Judged on language, vocabulary and fluency.',
      'Round 2 adds challenges: catch an opponent’s mistake and you take over the clock.',
      '0.5 points per second, a 5-point bonus for 20 unbroken seconds, and up to 10 bonus marks for humour.',
    ],
    contacts: [C('Yug Bhoi', '9978618124'), C('Disha Aggarwal', '8950781857')],
  },
  Oratio: {
    rules: [
      'Bilingual debate — speak in English or Hindi. Two sides of 4, finalised an hour before the debate.',
      'Round 1 opening: one speaker per team, 3 minutes. Round 2: the rest, 3 minutes each; unused time may transfer but no speech exceeds 5.',
      'Round 3 rebuttal: one question each (2 minutes), answered in 2. Round 4 closing: one speaker, 3 minutes.',
      'Marked out of 100 — content 30, clarity 20, delivery 20, teamwork 15, rebuttal 15.',
      'No personal attacks. A bell rings 30 seconds before your time ends.',
    ],
    contacts: [C('Gaurang Sharma', '9024635316'), C('Aarav', '9015093332')],
  },
  'Literary Escape Room': {
    rules: [
      'Teams of 1–3. Four rounds of riddles, puzzles and clues.',
      'Teams are eliminated each round; only 4 reach rounds 3 and 4.',
      'Every round is timed, and scoring goes to whoever solves the clues first.',
      'The winner is decided on the combined score of rounds 3 and 4.',
    ],
    contacts: [C('Sushma', '7892927158'), C('Jiya Rewari', '9714992770')],
  },
  Storysmiths: {
    rules: [
      'Teams of 3. Entrants without a team are paired with others on the day.',
      'Writer 1 gets a prompt, 5 minutes to think and 10 to write. Writers 2 and 3 read for 5 minutes, then continue for 10.',
      'Random keywords are handed out mid-event and must be worked in — creatively used, they earn extra points.',
      'No internet, AI tools, reference material or outside help. Anyone caught disqualifies the whole team.',
      'Everything must be written during the event. Winners are announced the following day.',
    ],
    contacts: [C('Sakshi Bodh', '9056661358'), C('Sushma', '7892927158')],
  },
  Taboo: {
    rules: [
      'Teams of 2–4. One describer, the rest guess.',
      'Get your team to the target word without using any of the taboo words on the card.',
      'Verbal clues only: no acting, gestures, spelling, rhyming hints or parts of the word.',
      'Sixty seconds a round, as many cards as you can. Skips are allowed and you can come back to them.',
    ],
    contacts: [C('Disha Aggarwal', '8950781857'), C('Kritika Singh', '9636031221')],
  },
  'Poetic Reveries': {
    rules: [
      'Individual English poetry recitation.',
      'The poem must be exclusively self-written. Theme is yours to choose.',
      'Five minutes maximum, with negative marking for overrunning.',
      'Judged on content, stage presence, recitation and audience response.',
    ],
    contacts: [C('Bhavika Khurana', '7740021203'), C('Jawariya Khan', '9622191644')],
  },
  Kavyotsav: {
    rules: [
      'Hindi poetry. Five minutes maximum, with negative marking for overrunning.',
      'Theme is yours to choose. No obscene language.',
      'Judged on content, stage presence, recitation and audience response.',
    ],
    contacts: [C('Gaurang Sharma', '9024635316')],
  },
  Logophilia: {
    rules: [
      'Teams of 2 preferred; lone wolves welcome.',
      'Rounds include spell bee (verbal and written), wordle, pronunciation, translation, decoding gibberish and etymology.',
      'Scores are cumulative across every round.',
      'No devices, notes or outside help unless the quizmaster allows it.',
      'Ties go to a tie-breaker round, and the quizmaster’s reading of an answer is final.',
    ],
    contacts: [C('Sakshi Bodh', '9056661358'), C('Aarzoo Ahluwalia', '6284114753')],
  },
  Declamation: {
    rules: [
      'Speak on one of the topics provided beforehand.',
      'Four to seven minutes. First bell at 4 minutes, final bell 30 seconds before 7.',
      'Assessed on command of the subject, explanatory and presentation skills, clarity, confidence, and how you open and close.',
    ],
    contacts: [C('Sushma', '7892927158'), C('Shreyas Jain', '7880530941')],
  },

  /* ---------------- Kalakriti ---------------- */

  'Fantasy Faces': {
    rules: [
      'Teams of 2: one is the canvas, the other the artist. Roles cannot swap once the clock starts.',
      'Theme announced before the competition begins.',
      '1.5 hours. Acrylic colours and brushes are provided.',
      'Offensive or inappropriate designs are disqualified.',
    ],
    contacts: [C('Bhavya', '8764213826'), C('Shreya', '8439365531')],
  },
  'Splash Tees': {
    rules: [
      'Individual. Theme announced before the competition begins.',
      '1.5 hours. T-shirts, paints and brushes are provided.',
      'Bring your own materials if you like — except the T-shirt.',
    ],
    contacts: [C('Bhavya', '8764213826'), C('Siddharth', '6393090764')],
  },
  'Contrast Chronicles': {
    rules: [
      'Individual black-and-white sketching. Theme announced before the start.',
      '2 hours. Sheets and pencils are provided.',
      'Bring extra media if you want — charcoal and the like are welcome.',
    ],
    contacts: [C('Bhavya', '8764213826'), C('Shreya', '8439365531')],
  },
  'Acrylic Odyssey': {
    rules: [
      'Individual. Theme announced before the start.',
      '2 hours. Canvas, paints and brushes are provided.',
      'Bring your own materials if you like — except the canvas.',
    ],
    contacts: [C('Ayush', '7985371801'), C('Siddharth', '6393090764')],
  },
  'Cupful of Doodles': {
    rules: [
      'Individual doodling on paper cups. Theme announced before the start.',
      '1 hour. Paper cups and sketch pens are provided.',
      'Offensive or inappropriate designs are disqualified.',
    ],
    contacts: [C('Rashi', '8200093641'), C('Shreya', '8439365531')],
  },
  'Caffeine Creations': {
    rules: [
      'Individual coffee painting. Theme announced before the start.',
      '1 hour. Coffee, brushes and sheets are provided.',
      'Pencils, paints and any other medium are not allowed.',
    ],
    contacts: [C('Bhavya', '8764213826'), C('Siddharth', '6393090764')],
  },
  'Brushless Strokes': {
    rules: [
      'Individual. Theme announced before the start.',
      '1.5 hours. Paints and sheets are provided.',
      'Bring sponges, knives, whatever you like — brushes are strictly prohibited.',
    ],
    contacts: [C('Bhavya', '8764213826'), C('Siddharth', '6393090764')],
  },
  'Stone Painting': {
    rules: [
      'Individual. Theme announced before the start.',
      '1.5 hours. Stones, paints and brushes are provided.',
      'Bring your own materials if you like — except ready-made or pre-painted stones.',
    ],
    contacts: [C('Siddharth', '6393090764'), C('Ayush', '7985371801')],
  },
  'Mould It Up': {
    rules: [
      'Individual clay modelling on the theme announced at the start.',
      '1 hour. Only clay is provided, and decorative extras are not allowed.',
      'Finish inside the allotted time.',
    ],
    contacts: [C('Rashi', '8200093641'), C('Bhavya', '8764213826')],
  },
  'Art Roulette': {
    rules: [
      'Teams of 2 and one canvas. Theme announced before the start.',
      'Partner A paints for 2 minutes, hands over to B for 2, and so on until the timer stops.',
      'You cannot discuss what to paint.',
      '1 hour. Judged on creativity and how well you adapt to each other’s work.',
      'Canvas, paints and brushes provided; bring your own materials except the canvas.',
    ],
    contacts: [C('Mudassir', '8861384164'), C('Bhavya', '8764213826')],
  },

  /* ---------------- Alfresco ---------------- */

  'Evening Amore': {
    date: '15 Oct',
    rules: [
      'Couples and singles both welcome. Single entries are paired by a randomised system.',
      'Leave midway and no new partner is assigned unless you re-register at the same fee.',
      'On-the-spot entries close at a set time; nothing is accepted after.',
      'No refunds once you are registered and a partner is assigned.',
      'Be well groomed. Lounge wear is not the look.',
    ],
    contacts: [C('Bharti', '9992605910'), C('Shifali', '9588132329')],
  },
  'Capture and Conquer': {
    date: '15 Oct',
    rules: [
      'Teams of 1–4. You get a list of items and activities, each worth points by how hard it is to find.',
      'Beg, borrow or steal — then photograph or film yourself doing it.',
      '60 minutes. No vehicles, and nobody leaves campus.',
      'Most points from items collected and tasks done, in the least time, wins.',
    ],
    contacts: [C('Anshika', '9079471020'), C('Upender', '8929830218')],
  },
  'Grab O Mania': {
    date: '14 Oct',
    rules: [
      'Teams of 4. One player is unblindfolded; the other three are not.',
      'The sighted player talks Player 2 through Task 1, then Player 3 guides Player 4, and so on.',
      'All three tasks run consecutively. Verbal instructions only.',
      'Blindfolds stay on. No running, pushing or physical guidance, and stay inside the marked area.',
    ],
    contacts: [C('Aanchal', '8799760114'), C('Suman', '7355833124')],
  },
  'Squid Game': {
    date: '13 Oct',
    rules: [
      'Four rounds on the given theme. Finish inside the time and you go through.',
      'Once it starts, nobody can be substituted.',
      'Cheating or unsportsmanlike behaviour ends your day.',
      'Damage the organisers’ property and you are liable for the repair.',
    ],
    contacts: [C('Shifali', '9588132329'), C('Shweta', '6376336764')],
  },
  Pictionary: {
    date: '16 Oct',
    rules: [
      'Teams of 3–5, fixed once the game starts.',
      'Round 1 classic: two minutes a team, three skips, top 5 go through.',
      'Round 2: same, but you draw with your non-dominant hand. Top 3 reach the final.',
      'Round 3 relay: one guesser, everyone else draws in 15-second turns, one skip.',
      'Drawing only. Gestures, sounds, words, mumbled hints or lip movements are disqualification.',
    ],
    contacts: [C('Shweta', '6376336764'), C('Upender', '8929830218')],
  },
  'Paper Dance': {
    date: '13 Oct',
    rules: [
      'Pairs dance on a newspaper and fold it in half every time the music stops.',
      'Ten pairs per round. Step outside the paper and you are out.',
      'Any pairing of genders is accepted; changing partner mid-round is prohibited.',
      'The songs are ours to choose. The last pair standing wins.',
    ],
    contacts: [C('Ronak', '9350600914'), C('Hariom', '8949029464')],
  },
  'Balloon Burst': {
    date: '16 Oct',
    rules: [
      'One player inflates balloons; the other bursts them by sitting on them on the chair.',
      'No hands, no sharp objects.',
      'A balloon counts only when fully burst with the knot visible.',
      'Most balloons inside the time limit — or all of them soonest — wins.',
    ],
    contacts: [C('Aanchal', '8799760114'), C('Asmita', '9835846797')],
  },
  'Treasure Hunt': {
    date: '14 Oct',
    rules: [
      'Teams of 2–4, armed with clues and riddles that lead from place to place.',
      'A race against the clock: solve the puzzles, follow the hints, find the treasure.',
      'Rewards teamwork and lateral thinking more than trivia.',
    ],
    contacts: [C('Bharti', '9992605910'), C('Anshika', '9079471020')],
  },
  'Songstra Vaganza': { date: '15 Oct', rules: ['Teams of 2–4.', 'A melody marathon: keep the songs coming.'] },
  Tambola: { date: '16 Oct', rules: ['Individual entry.', 'Housie, the way you remember it.'] },
  'Musical Chairs': { date: '13 Oct', rules: ['Individual entry.', 'Spin, scramble, sit.'] },
  'Soul Sync': { date: '13 Oct', rules: ['Teams of 2.', 'How well do you actually know each other?'] },
  'Drape It': { date: '15 Oct', rules: ['Teams of 2.', 'A styling face-off against the clock.'] },
  'Dumb Charades': { date: '14 Oct', rules: ['Teams of 3–5.', 'Act it out. Never say it.'] },
  'Swift Mingle': { date: '14 Oct', rules: ['Individual entry, priced separately for boys and girls.', 'Speed connect: a room full of strangers and a very short clock.'] },

  /* ---------------- Thunderbolt (external Google Forms) ---------------- */

  BGMI: {
    rules: [
      'Battle Royale (₹400 per team) and TDM (₹200 per team).',
      'Squads of at least 4, fixed after round one — changing members is disqualification.',
      'League stage then a final round; the top 16 teams go through.',
      'Placement points #1: 10 down to #8: 1, plus 1 point per finish.',
      'Mobiles and tablets only, original app store installs only. Organisers spectate every match.',
    ],
    contacts: [C('Bharat', '9588957283'), C('Lokesh', '6238930083')],
  },
  'COD: Mobile': {
    rules: [
      'Multiplayer. Teams of exactly 5, fixed after round one.',
      'Online league; each round is 3 matches. Qualifiers run Search & Destroy, Hardpoint and Frontline.',
      'Maps are drawn by the organisers and announced with the fixtures. Semis and finals use 5 modes.',
      'Fixtures by 3:00 PM the same day; matches 8:00 PM–12:30 AM.',
      'Restricted weapons, attachments, perks and scorestreaks are listed in the rulebook. Wildcards are allowed.',
      'Prize pool ₹6,000.',
    ],
    contacts: [C('Bharat', '9588957283'), C('Lokesh', '6238930083')],
  },
  'Free Fire': {
    rules: [
      'Battle Royale (₹250 per team) and Clash Squad (₹200 per team).',
      'Squads of at least 4, fixed after round one.',
      'League stage then a final round; the top 12 teams go through. Maps: Bermuda and Kalahari.',
      'Booyah is 12 points down to 2 for #9–10, plus 1 point per kill.',
      'Gun skin attributes are turned off. All skins and certain characters are banned; 1 active + 3 passive skills only.',
      'Mobiles and tablets only, original app store installs only.',
    ],
    contacts: [C('Lokesh', '6238930083'), C('Aalok', '8529187199')],
  },
  'Clash Royale': {
    rules: [
      'Registration ₹125. Game mode: Duel Battle.',
      'Three rounds — in-game tournament, last chance qualifiers, then playoffs.',
      'Open to medical students of batch 2021 or later.',
      'Newly released broken cards, Evos or Heroes may be banned; the call is the organisers’ and is announced beforehand.',
      'Prize pool ₹1,800.',
    ],
    contacts: [C('Jayesh', '6375152434')],
  },
  'E-Chess': {
    rules: [
      'Registration ₹100. Played on Chess.com; this is in addition to the over-the-board bullet tournament, not instead of it.',
      'Round 1 preliminary: Swiss, 10 rounds at 1+1. Top 30 advance.',
      'Round 2 final: Swiss, 7 rounds at 2+1.',
      'Every game is reviewed. Unfair means means immediate disqualification.',
      'Prize pool ₹3,000.',
    ],
    contacts: [C('Bharat', '9588957283'), C('Jayesh', '6375152434')],
  },
  Tekken: {
    rules: [
      'Basic Registration is mandatory.',
      'Players are split into pools; each pool is a knockout, and pool winners go to the finals.',
      'The finals are knockout, and drawn matches are settled by sudden death.',
      'Bring your own controller or keyboard if you prefer one.',
      'Miss your scheduled match and you are disqualified.',
    ],
    contacts: [C('Harshit', '7988320052')],
  },
  'Mortal Kombat': {
    rules: [
      'Basic Registration is mandatory.',
      'Players are split into pools; each pool is a knockout, and pool winners go to the finals.',
      'The finals are knockout, and drawn matches are settled by sudden death.',
      'Bring your own controller or keyboard if you prefer one.',
      'Miss your scheduled match and you are disqualified.',
    ],
    contacts: [C('Harshit', '7988320052')],
  },
  FIFA: {
    rules: [
      'Basic Registration is mandatory.',
      'Players are split into pools; each pool is a knockout, and pool winners go to the finals.',
      'Pool matches are 6 minutes a half; finals are 8. Draws go to penalties.',
      'All-Stars and Legends clubs are not allowed. International teams are.',
      'Bring your own controller or keyboard if you prefer one.',
    ],
    contacts: [C('Harshit', '7988320052')],
  },
}

/** The rules for one event, or null when its rulebook hasn't landed yet. */
export function detailFor(eventName: string): EventDetail | null {
  return eventDetail[eventName] ?? null
}

/**
 * The published rulebooks, one entry per PDF.
 *
 * Deduplicated by file because SOLASTA is a single book covering Sinfonia,
 * Chorea and Thespians: listing it three times would read like three downloads
 * that are not there.
 */
export const publishedRulebooks = [
  ...territories
    .filter((t) => t.rulebook)
    .reduce((acc, t) => {
      const hit = acc.get(t.rulebook!)
      if (hit) hit.codes.push(t.code)
      else acc.set(t.rulebook!, { file: t.rulebook!, codes: [t.code] })
      return acc
    }, new Map<string, { file: string; codes: string[] }>())
    .values(),
]

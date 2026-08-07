/* ==========================================================================
   journal.ts — Journal articles. Each post renders as a real editorial page:
   a full-bleed hero, an "On this page" table of contents built from the
   section headings, section bodies (each with an optional inset image),
   a closing FAQ and a tag list. `journalTeasers` powers the homepage +
   index cards (thinner surface).
   ========================================================================== */

import type { ImageMetadata } from "astro";
import type { FaqItem } from "./faq";

import adayintuscanyImg1 from "../assets/images/journal/a-day-in-tuscany-1.jpg";
import adayintuscanyImg2 from "../assets/images/journal/a-day-in-tuscany-2.jpg";
import adayintuscanyImg3 from "../assets/images/journal/a-day-in-tuscany-3.jpg";
import adayintuscanyImg4 from "../assets/images/journal/a-day-in-tuscany-4.jpg";
import adayintuscanyImg5 from "../assets/images/journal/a-day-in-tuscany-5.jpg";
import sangimignanoImg1 from "../assets/images/journal/san-gimignano-1.jpg";
import sangimignanoImg2 from "../assets/images/journal/san-gimignano-2.jpg";
import sangimignanoImg3 from "../assets/images/journal/san-gimignano-3.jpg";
import sangimignanoImg4 from "../assets/images/journal/san-gimignano-4.jpg";
import sangimignanoImg5 from "../assets/images/journal/san-gimignano-5.jpg";
import sangimignanoImg6 from "../assets/images/journal/san-gimignano-6.jpg";
import volterraImg1 from "../assets/images/journal/volterra-1.jpg";
import volterraImg2 from "../assets/images/journal/volterra-2.jpg";
import volterraImg3 from "../assets/images/journal/volterra-3.jpg";
import volterraImg4 from "../assets/images/journal/volterra-4.jpg";
import volterraImg5 from "../assets/images/journal/volterra-5.jpg";
import volterraImg6 from "../assets/images/journal/volterra-6.jpg";
import romanticmaremmaImg1 from "../assets/images/journal/romantic-maremma-1.jpg";
import romanticmaremmaImg2 from "../assets/images/journal/romantic-maremma-2.jpg";
import romanticmaremmaImg3 from "../assets/images/journal/romantic-maremma-3.jpg";
import romanticmaremmaImg4 from "../assets/images/journal/romantic-maremma-4.jpg";
import romanticmaremmaImg5 from "../assets/images/journal/romantic-maremma-5.jpg";
import romanticmaremmaImg6 from "../assets/images/journal/romantic-maremma-6.jpg";

/** A section = one H2 heading, its paragraphs, and an optional inset image. */
export interface JournalSection {
  /** Heading text (rendered as an H2). */
  heading: string;
  /** URL-safe anchor id — must be unique within the article (feeds the TOC). */
  slug: string;
  /** Body paragraphs, in order. */
  body: string[];
  /** Optional inset image beneath the heading. */
  image?: ImageMetadata;
  imageAlt?: string;
}

export interface JournalArticle {
  slug: string;
  title: string;
  category: "Local Life" | "Day Trips" | "Romance";
  /** Short standfirst shown under the title in the hero + on index cards. */
  excerpt: string;
  /** Byline + date for the hero meta row. */
  author: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Lead image — hero background + index/card image. */
  image: ImageMetadata;
  imageAlt: string;
  /** The article body, split into anchored sections. */
  sections: JournalSection[];
  /** Closing questions. */
  faqs: FaqItem[];
  /** Lowercase topical tags (rendered as #chips). */
  tags: string[];
}

export const journal: JournalArticle[] = [
  {
    slug: "a-day-in-tuscany-espresso-to-aperitivo",
    title: "A Day in Tuscany: From Morning Espresso to Late-Night Aperitivo",
    category: "Local Life",
    excerpt:
      "Local life in the Maremma runs on rhythm, not a schedule. A guide to the shape of a Tuscan day, from the first espresso at the bar to a long, late dinner under the stars.",
    author: "Villa Dolce Vita",
    date: "2026-06-02",
    image: adayintuscanyImg1,
    imageAlt: "A marble café counter in a Tuscan town at morning, a small espresso and a cornetto in the soft early light",
    sections: [
      {
        heading: "The Market Comes Early",
        slug: "the-market-comes-early",
        body: [
          "The morning belongs to work and errands, and both are done before the heat arrives. In every town in the Maremma there is a market, on its appointed morning, and it is where the day's real business happens. The stalls go up early. Tomatoes in heaps that smell of the vine, peaches so ripe they bruise at a glance, bread still warm, cheese cut to order, flowers, fish, and a great deal of loud and friendly haggling that is half commerce and half theater. Go early, while the light is soft and the vendors are fresh, and buy the things that look best rather than the things you planned. The person who grew the tomato is standing right there, and they will tell you when to eat it. Listen to them.",
          "This is the hour to see a town awake and unguarded. Shopkeepers sweep their steps. Old men claim their benches. The espresso machines hiss without pause. By the time the sun climbs high, the shopping is done, the day's food is bought, and everyone is thinking about the same thing, which is lunch, and after lunch, the sacred pause.",
        ],
        image: adayintuscanyImg2,
        imageAlt: "The Market Comes Early — A Day in Tuscany",
      },
      {
        heading: "Noon, and the Wisdom of Stopping",
        slug: "noon-and-the-wisdom-of-stopping",
        body: [
          "Here is the part visitors find hardest to accept, and the part they miss most once they are home. In the middle of the day, Tuscany more or less closes. Around one o'clock the shutters come down, the shops lock their doors, and the towns go quiet under the weight of the heat. This is the riposo, the long midday pause, and it is not laziness. It is sense. When the sun is at its fiercest, the sensible thing is to be indoors, fed, and horizontal. Lunch is taken slowly, then the afternoon is surrendered to a nap, a book, a shaded chair, the slow digestion of both food and time.",
          "Fight this and you will spend the early afternoon wandering a ghost town, tugging at locked doors. Join it and you will understand why the people here live long and complain little. At the estate the pause writes itself. Lunch on the terrace, then the pool, or the shade of an olive tree, or a doze with the shutters half closed and the cicadas sawing away outside. Do nothing, and do it thoroughly. The town will reopen when the heat breaks, and so, refreshed, will you.",
        ],
      },
      {
        heading: "The Evening Stroll",
        slug: "the-evening-stroll",
        body: [
          "Late in the afternoon, as the light softens and the worst of the heat lets go, the towns come back to life, and with them comes one of the loveliest habits in Italian life. The passeggiata is simply a walk, taken in the early evening, for no reason beyond the pleasure of it. Families come out. Old friends fall into step. Children run ahead. Everyone dresses a shade better than the errand requires and processes slowly along the main street or the seafront, greeting, pausing, being seen and seeing. Nothing is bought and nowhere is reached. That is the whole point. It is a society taking its own temperature, gently, every single evening, and you are welcome to join it. Walk slowly. Stop often. Nod to strangers. You will fit right in.",
        ],
        image: adayintuscanyImg3,
        imageAlt: "The Evening Stroll — A Day in Tuscany",
      },
      {
        heading: "The Aperitivo Hour",
        slug: "the-aperitivo-hour",
        body: [
          "Then comes the hinge of the whole day, the hour that turns afternoon into night: the aperitivo. As the sun drops, the bars set out their small plates, and people gather to bridge the gap before dinner. This is not a meal and not quite a drink. It is a pause with company, an hour of olives and crostini and little bites, taken at an outdoor table while the light does something remarkable to the buildings. In the countryside it is unhurried and warm. On the coast it comes with the sea going gold. Either way it is the moment the day exhales.",
          "A note in fairness, since the aperitivo usually arrives with a glass in hand. Italy is under a temporary rule that has paused the serving of alcohol, and every proper bar, ourselves among them, is honoring it for as long as it holds. Happily, the ritual was never really about what was in the glass. It was about the hour, the plates, the company, and the light. A well-made non-alcoholic spritz or a cold pressed juice sits just as nicely on the table, and the conversation runs exactly as long. When the toasts return, they will taste of the wait. Until then, the sunset does the heavy lifting, and it always has.",
        ],
      },
      {
        heading: "Dinner Is the Destination",
        slug: "dinner-is-the-destination",
        body: [
          "Everything the day has done has been leading here, to a long dinner eaten late and outdoors. The Tuscan evening meal is not rushed and not early. Kitchens warm up around half past eight, and a table at nine is entirely ordinary. The food comes in courses, unhurried, a little antipasto, then pasta, then something from the grill, then cheese, then a sweet, then coffee, then more talk. It can stretch across two or three hours and nobody minds, because the meal is not a refueling stop. It is the event. It is where the day was always going.",
          "Eat outside if you possibly can, under a pergola or the open sky, with the candles lit and the air finally cool. At the estate this is our favorite hour of all: a long table on the terrace, the valley going dark below, the food coming out of the kitchen in no particular rush, the conversation looping and pausing and starting again. There is no signal that dinner has ended. It simply thins, softens, and gives way to the quiet, and someone eventually looks up and notices how many stars have come out.",
        ],
        image: adayintuscanyImg4,
        imageAlt: "Dinner Is the Destination — A Day in Tuscany",
      },
      {
        heading: "Living the Rhythm",
        slug: "living-the-rhythm",
        body: [
          "That is a Tuscan day, start to finish. Coffee at the counter, the market before the heat, the long pause at noon, the walk at dusk, the plates at sunset, the late and lingering dinner under the sky. You cannot rush it, and the joy is in not trying. Most guests spend a day or two out of step, checking the clock, wondering why the shops are shut. Then something loosens, and they stop asking, and they start living to the tempo instead. That is the moment the holiday truly begins.",
          "We built this place to make that easy. The rhythm is already here, in the light and the hours and the pace of the hill. All you have to do is arrive, put the watch in a drawer, and let the day carry you. It knows the way. It has known it for a very long time.",
        ],
        image: adayintuscanyImg5,
        imageAlt: "Living the Rhythm — A Day in Tuscany",
      },
    ],
    faqs: [
      {
        q: "Why do shops close in the middle of the day in Tuscany?",
        a: "Because of the riposo, the traditional midday pause. When the sun is at its hottest, towns quiet down for lunch and rest, usually from around one until late afternoon. It is a sensible rhythm, and joining it is part of the pleasure.",
      },
      {
        q: "What is the aperitivo?",
        a: "The pre-dinner ritual of gathering for a drink and small plates as the sun sets. It is less about the food or the glass than about the hour and the company. A temporary rule has currently paused the serving of alcohol, so non-alcoholic options stand in for now.",
      },
      {
        q: "What are the rules about ordering coffee?",
        a: "Espresso any time, especially after meals, taken standing at the bar. A milky coffee such as a cappuccino is a morning drink, rarely ordered after eleven. It is a soft social code rather than a real law, but locals notice.",
      },
      {
        q: "What time is dinner in Tuscany?",
        a: "Late by many visitors' standards. Kitchens get going around half past eight, and a nine o'clock table is normal. Meals are long and come in courses, best enjoyed outdoors and without hurry.",
      },
      {
        q: "Can I experience this daily rhythm at Villa Dolce Vita?",
        a: "Entirely. The estate is built for it: slow breakfasts, a midday pause by the pool, and long dinners on the terrace under the stars. We can also arrange market visits and dinners to match the local pace.",
      },
    ],
    tags: ["tuscany", "local life", "aperitivo", "slow living", "maremma", "food culture"],
  },
  {
    slug: "day-trip-san-gimignano-city-of-towers",
    title: "A Day Trip to San Gimignano: The Medieval City of Towers",
    category: "Day Trips",
    excerpt:
      "Ninety minutes from Villa Dolce Vita stands a hill town that never stopped competing with itself. A day among the towers, the wine, and the best gelato in Tuscany.",
    author: "Villa Dolce Vita",
    date: "2026-05-24",
    image: sangimignanoImg1,
    imageAlt: "The medieval towers of San Gimignano rising above terracotta rooftops against the Tuscan hills at golden hour",
    sections: [
      {
        heading: "The Towers Were a Competition",
        slug: "the-towers-were-a-competition",
        body: [
          "There were once more than seventy of them. Fourteen survive, and that alone is remarkable, because most Italian towns lost theirs to time, war, and common sense. Here they went up between the eleventh and thirteenth centuries for one reason above all others: pride. The great families raised towers to outdo one another, higher and higher, until the town passed a law forbidding anyone to build taller than the municipal tower. Two rival families, refusing to be beaten, simply built a matching pair side by side. You can still see them. Petty ambition, frozen in stone, and rather beautiful for it.",
          "The one to climb is the Torre Grossa, the tallest at fifty-four meters, begun in 1300 and attached to the old town hall. There are a little over two hundred steps, a spiral, a final ladder, and a low ceiling that will humble the tall. But the view at the top is the one you came for. Terracotta roofs below, the other towers close enough to touch with your eyes, and the countryside rolling out in every direction until it dissolves into haze. Go up near the end of the afternoon if you can. The light does most of the work.",
        ],
        image: sangimignanoImg2,
        imageAlt: "The Towers Were a Competition — A Day Trip to San Gimignano",
      },
      {
        heading: "Two Squares, One Well",
        slug: "two-squares-one-well",
        body: [
          "The heart of the town is really two hearts, side by side. Piazza della Cisterna takes its name from the old cistern beneath it, capped by a stone well that has watched over the square for centuries. The bricks are laid in a herringbone pattern on a gentle slope, which plays a small trick on the eyes, so that everyone appears to be walking uphill whether they are or not. Sit here a while and watch it happen. It is quietly funny.",
          "A few steps away lies Piazza del Duomo, and with it the Collegiata, the town's great church. From the outside it keeps its secrets, plain and unassuming. Inside, the walls open into frescoes that have not faded in six hundred years, whole testaments painted floor to ceiling in colors that still hold. Give it twenty minutes, more if the crowds are thin. This is the sort of room that rewards standing still.",
          "Around the squares run lanes barely wide enough for two, threaded with small workshops and enoteche. The town sat on the Via Francigena, the old pilgrim road from the north down to Rome, and it grew rich feeding and sheltering the faithful. That habit of hospitality never really left. It simply changed its clientele.",
        ],
        image: sangimignanoImg6,
        imageAlt: "Two Squares, One Well — A Day Trip to San Gimignano",
      },
      {
        heading: "Wine You Cannot Get at Home",
        slug: "wine-you-cannot-get-at-home",
        body: [
          "San Gimignano has one great wine, and it is white, which surprises people who arrive expecting Tuscany to be all red. Vernaccia di San Gimignano is crisp and mineral and bright, the kind of thing you want on a warm afternoon with nothing pressing on the calendar. It carries a small piece of history too. Back in 1966 it became the first Italian wine of any color to earn the country's official mark of quality, which the locals will mention with the studied casualness of people who are, in fact, very proud.",
          "Taste it at an enoteca in town, or climb to the Rocca, the ruined fortress at the top, where a small museum tells the story of the wine and pours a glass at the end. The view from up there is the reward either way, so you win no matter what is in the glass. Just now, a note in fairness: Italian law has paused the sale and serving of wine while a temporary regulation is in force, and we follow it to the letter. Take the tour for the vines and the history, and toast the place properly another season.",
        ],
        image: sangimignanoImg3,
        imageAlt: "Wine You Cannot Get at Home — A Day Trip to San Gimignano",
      },
      {
        heading: "The Gelato Question",
        slug: "the-gelato-question",
        body: [
          "We should be honest about one thing. A fair number of visitors come to San Gimignano less for the towers than for the ice cream, and we understand entirely. On Piazza della Cisterna sits Gelateria Dondoli, run by a man who has won the gelato world championship more than once, which is a sentence that should not be possible and yet here we are. The flavors run to the inventive. Saffron and pine nut. Raspberry and rosemary. There is a queue, always, and it looks worse than it is, because it moves like a well-run kitchen. Join it. Order something you would never order at home. Eat it in the shade of the covered loggia while the town does its slow medieval business around you.",
        ],
        image: sangimignanoImg5,
        imageAlt: "The Gelato Question — A Day Trip to San Gimignano",
      },
      {
        heading: "How to Do It Properly",
        slug: "how-to-do-it-properly",
        body: [
          "A few things learned the hard way, offered as a host would offer them. The town is small enough to walk in a morning, but walking through and taking it in are not the same, so give it more time than the map suggests. The crowds thicken between ten and four, and in high summer the weekends are best avoided entirely. Arrive early. The lanes belong to almost no one at nine, and the walls at that hour give you the countryside without another soul in the frame.",
          "Leave the car in one of the lots below the walls, since the old town is closed to traffic, and make the short climb up on foot. Wear something honest on your feet. These are medieval streets, and they were not laid with comfort in mind. Bring a hat in summer and a light layer for the tower, which catches the wind.",
          "From the estate, the drive up is part of the pleasure. Wind north through the wine country, spend the middle of the day among the towers, and time your return for the golden hour, when the whole of the Val d'Elsa turns the color of the stone. If you would rather not drive, mention it at breakfast and we will help you arrange a car and a guide who actually knows the place.",
          "San Gimignano has been standing on that hill, doing more or less exactly this, for the better part of a thousand years. It does not need us to talk it up, and it has never asked for the crowds it draws. Go early, walk slowly, look up often. The towers have waited this long. They will wait for you.",
        ],
        image: sangimignanoImg4,
        imageAlt: "How to Do It Properly — A Day Trip to San Gimignano",
      },
    ],
    faqs: [
      {
        q: "How far is San Gimignano from Villa Dolce Vita?",
        a: "Roughly ninety minutes by car, heading north through the Tuscan wine country. It makes a comfortable day trip with time to spare for lunch and a slow wander.",
      },
      {
        q: "How long do I need to see San Gimignano?",
        a: "Half a day covers the highlights, though a full day lets you climb the tower, see the frescoes, and still linger in the squares without rushing. Arriving early is the single best decision you can make.",
      },
      {
        q: "Can you climb the towers?",
        a: "Two are open to the public, and the tallest, Torre Grossa, is the one to climb. Expect just over two hundred steps and a view worth every one of them.",
      },
      {
        q: "What is San Gimignano famous for besides the towers?",
        a: "Vernaccia di San Gimignano, a crisp white wine with deep local roots, and Gelateria Dondoli, whose gelato has won world titles. The frescoes inside the Collegiata are a quiet marvel in their own right.",
      },
      {
        q: "When is the best time to visit?",
        a: "Early morning, before the day-trippers arrive, and outside the summer weekends if you can manage it. Spring and autumn are kindest of all, with soft light and thinner crowds.",
      },
    ],
    tags: ["san gimignano", "tuscany", "day trips", "medieval towns", "vernaccia", "unesco"],
  },
  {
    slug: "day-trip-volterra-alabaster-etruscan",
    title: "A Day Trip to Volterra: Alabaster, Etruscan Secrets, and Panoramic Views",
    category: "Day Trips",
    excerpt:
      "An easy day trip from Villa Dolce Vita to Volterra, a windswept hill town layered with Etruscan gates, a Roman theatre, medieval streets, and workshops of translucent alabaster.",
    author: "Villa Dolce Vita",
    date: "2026-05-10",
    image: volterraImg1,
    imageAlt: "The walled hill town of Volterra rising above the Tuscan countryside, its stone ramparts catching low afternoon light",
    sections: [
      {
        heading: "The Etruscans Were Here First",
        slug: "the-etruscans-were-here-first",
        body: [
          "Long before Rome, this was Velathri, one of the great cities of the Etruscans, and their fingerprints are still all over it. The most striking is the Porta all'Arco, a city gate that has stood for roughly two and a half thousand years. Look up as you pass beneath it and you will see three worn stone heads set into the arch, their features long since eroded to blank stumps. Nobody knows for certain who or what they were meant to be. That uncertainty, hanging over a gate older than most countries, is exactly the sort of thing Volterra does well.",
          "To understand the people who built it, spend an hour in the Guarnacci Museum, which opened its doors in 1761 and is among the oldest public museums anywhere in Europe. It holds one of the finest collections of Etruscan art in existence: hundreds of carved funerary urns, everyday objects, and one small bronze figure that stops everyone in their tracks. It is a young man, stretched impossibly long and thin, and it looks so startlingly modern that a famous twentieth-century sculptor might have made it yesterday. The Etruscans got there two and a half millennia early. On the edge of town, the old acropolis still shows the footings of their temples and the clever cisterns they cut to catch rainwater, since the hill has no spring of its own. These were resourceful people, and Volterra remembers them better than almost anywhere.",
        ],
        image: volterraImg2,
        imageAlt: "The Etruscans Were Here First — A Day Trip to Volterra",
      },
      {
        heading: "Then Came Rome",
        slug: "then-came-rome",
        body: [
          "Below the northern walls lies the next layer down, or rather up, in time. The Roman theatre is one of the best preserved in Italy, a graceful semicircle of stone seats built in the first century before Christ, with the remains of a bath complex behind the stage. It once held several thousand spectators, and enough of it survives that you can easily people the empty seats in your mind. Here is a small piece of local wisdom worth knowing: you can pay to walk among the ruins, or you can simply stroll the city walls above and look straight down onto the whole site for nothing at all. The view from up there, with the theatre laid out below and the hills beyond, is arguably the better one anyway.",
        ],
        image: volterraImg6,
        imageAlt: "Then Came Rome — A Day Trip to Volterra",
      },
      {
        heading: "The Middle Ages, and a Very Unusual Restaurant",
        slug: "the-middle-ages-and-a-very-unusual-restaurant",
        body: [
          "Climb up into the town and the centuries close in around you. The heart of it is the Piazza dei Priori, a severe and handsome medieval square dominated by the Palazzo dei Priori, which claims the title of the oldest town hall in all of Tuscany, begun in the early thirteenth century. Florence borrowed the idea for its own famous palace, which tells you something about Volterra's standing in those days. Nearby stands the cathedral, plain outside and richly worked within, worth a quiet few minutes.",
          "Above it all looms the Medici fortress, a great fist of a building thrown up to remind the town who was in charge after Florence took control. It still does a version of that job today, because for well over a century it has served as a prison, which makes it one of the few fortresses in Tuscany you admire strictly from the outside. There is a curious footnote here. On certain evenings, the inmates cook and serve dinner to the public within the walls, an event that books out far in advance and is, by all accounts, remarkably good. It is the only reservation in Tuscany where the chef cannot leave. Only in Volterra.",
        ],
        image: volterraImg3,
        imageAlt: "The Middle Ages, and a Very Unusual Restaurant — A Day Trip to Volterra",
      },
      {
        heading: "The City of Alabaster",
        slug: "the-city-of-alabaster",
        body: [
          "If one craft belongs to this town, it is alabaster. The soft, translucent stone has been mined in the surrounding hills and carved here since Etruscan times, worked into urns and vases and lamps and figures that seem to hold the light inside them. The tradition is still alive, and that is the real pleasure. Wander the old streets and you will find workshops where artisans sit at their benches, turning and shaping the stone in a haze of pale dust, and many are happy for you to watch. There is something quietly moving about it, a craft handed down across a hundred generations, still being practiced by hand a few steps from where the Etruscans first tried it.",
          "For the fuller story, the small alabaster museum, housed in a medieval tower, lays out the history and shows what the finest hands can do with the stone. And if a piece catches your eye, buy it from the maker rather than a souvenir shelf. A small alabaster bowl carried home glows on a windowsill for years, and it comes with a story no factory object can match.",
        ],
      },
      {
        heading: "The Views, and the Broken Land",
        slug: "the-views-and-the-broken-land",
        body: [
          "Volterra sits high and alone, so the views are long in every direction, out over a wide sweep of hills toward the distant sea. Walk any stretch of the old walls at the right hour and the whole of central Tuscany seems to open beneath you. For something stranger, head to the edge of town to see Le Balze, a series of dramatic clay cliffs where the ground has crumbled and slid away over centuries, swallowing roads, buildings, and even a medieval church as it went. It is a reminder that even a town this ancient sits on shifting ground, and it is at its most haunting toward sunset, when the raw earth glows gold and the emptiness beyond the edge feels very old indeed.",
          "One light aside, since visitors always ask. Volterra played a starring role in a famous series of vampire films, as the home of an ancient and well-dressed clan. The town leans into it gently, though the films themselves were shot elsewhere, in a town to the south. The real Volterra needs no fiction. Its actual history is stranger and grander than anything a screenwriter could invent.",
        ],
        image: volterraImg4,
        imageAlt: "The Views, and the Broken Land — A Day Trip to Volterra",
      },
      {
        heading: "How to Do It",
        slug: "how-to-do-it",
        body: [
          "A few practical notes to smooth the day. The old town is closed to traffic, so leave the car in one of the lots below the walls and walk up. If you plan to visit several sites, the combined town pass is good value and covers the museum, the theatre, the alabaster collection, the town hall, and the acropolis over a couple of days. Wear proper shoes, since Volterra is all slopes and old stone, and bring a layer even in summer, because the hill catches a wind that the sheltered valleys never feel.",
          "Half a day covers the highlights, but a full day lets the place breathe, with time for the museum, a workshop, a long lunch, and an hour on the walls at the end when the crowds thin and the light turns. From the estate it is a straightforward drive north, and one of the more rewarding days you can spend inland. Tell us the night before and we will point you to the right car park, the best workshop to watch, and a table worth booking. Volterra has been receiving visitors for three thousand years. It will make room for you too, and it will not try to sell you anything you do not want, which is more than most famous towns can say.",
        ],
        image: volterraImg5,
        imageAlt: "How to Do It — A Day Trip to Volterra",
      },
    ],
    faqs: [
      {
        q: "How far is Volterra from Villa Dolce Vita?",
        a: "About an hour and fifteen minutes by car, heading north. It makes a comfortable day trip with time for museums, a workshop visit, and a long lunch.",
      },
      {
        q: "What is Volterra known for?",
        a: "Its remarkable layers of history, from the Etruscan Porta all'Arco and the Guarnacci Museum to a Roman theatre and medieval streets, and above all its centuries-old alabaster craft, still practiced in workshops around town.",
      },
      {
        q: "Can I watch alabaster being carved?",
        a: "Yes. Several workshops in the old town let you watch artisans shape the translucent stone by hand, and the alabaster museum tells the fuller story. Buying a piece directly from the maker is the finest souvenir Volterra offers.",
      },
      {
        q: "Is there a combined ticket for the sights?",
        a: "Yes, a town pass covers the main sites, including the Etruscan museum, the Roman theatre, the alabaster collection, the town hall, and the acropolis, over a couple of days. It is good value if you plan to see several.",
      },
      {
        q: "How long do I need in Volterra?",
        a: "Half a day covers the essentials, but a full day lets you take in the museum, a workshop, lunch, and the views from the walls without rushing. Wear good shoes and bring a light layer, as the hilltop catches the wind.",
      },
    ],
    tags: ["volterra", "etruscan", "alabaster", "day trips", "tuscany", "history"],
  },
  {
    slug: "romantic-evening-maremma",
    title: "A Romantic Evening in Maremma: Candlelit Dinners and Starry Nights",
    category: "Romance",
    excerpt:
      "The Maremma is quietly, unshowily romantic. Ideas for couples near Villa Dolce Vita: intimate candlelit dinners, night walks through medieval squares, and a sky full of stars.",
    author: "Villa Dolce Vita",
    date: "2026-04-20",
    image: romanticmaremmaImg1,
    imageAlt: "A candlelit table for two on a Tuscan terrace at night, the valley dark below and a sky thick with stars overhead",
    sections: [
      {
        heading: "A Table for Two, by Candlelight",
        slug: "a-table-for-two-by-candlelight",
        body: [
          "It begins, as most good Italian evenings do, with dinner. The Maremma is full of small, characterful places to eat, and the smaller the better when it is just the two of you. Massa Marittima, fifteen minutes away, keeps a handful of tiny osterias tucked into its medieval lanes, one of them so small it makes a genuine claim to being among the littlest in all of Italy, a dozen seats and a short menu and a great deal of charm. There is an intimacy to a room like that which no grand dining hall can manufacture. You are practically dining in someone's home, because more or less, you are.",
          "For a different mood, take a table down on the coast, where a few seafront restaurants set their places right at the edge of the sand, so you dine with the sound of the water and the lights of the fishing boats out on the dark. Or sit under a pergola at a country trattoria, vines overhead, the valley going quiet around you. Wherever you land, eat slowly and let the courses come in their own time. A note in fairness, since a candlelit dinner usually invites a shared bottle: Italy is currently under a temporary rule pausing the serving of alcohol, which every good table is honoring. The romance, happily, was never in the wine. It was in the candle, the low voices, the plate shared across the table, and the hour that refuses to be hurried. Those are all still on the menu.",
        ],
        image: romanticmaremmaImg2,
        imageAlt: "A Table for Two, by Candlelight — A Romantic Evening in Maremma",
      },
      {
        heading: "A Walk in the Dark",
        slug: "a-walk-in-the-dark",
        body: [
          "Do not go straight home after dinner. The best part of a Maremma evening often comes next, in the walk. The Italians make an art of the after-dinner stroll, and a medieval town after dark is made for two people wandering with no particular destination. Massa Marittima is close to perfect for it. Once the day-trippers have gone, the lanes empty out, the great cathedral stands floodlit and silent above its sloping square, and the whole town seems to belong to whoever is still awake to walk it. Climb up toward the upper walls, where the lights of the valley spread out below and the air cools, and you will find you have the view, and the moment, entirely to yourselves.",
          "The smaller hill villages offer the same quiet magic with even fewer people, just stone and shadow and the occasional cat. Down on the coast, the seafront promenades stay gently alive into the night, good for a slower, hand-in-hand kind of walk with the sea breathing beside you. None of this needs planning. It just needs the willingness to stay out a little longer than you meant to, which on a warm Tuscan night is no hardship at all.",
        ],
        image: romanticmaremmaImg6,
        imageAlt: "A Walk in the Dark — A Romantic Evening in Maremma",
      },
      {
        heading: "Look Up",
        slug: "look-up",
        body: [
          "Here is the part the cities have lost and the Maremma still keeps: the dark. Out here, away from the glare of streetlights, the night sky comes back in full, and on a clear, moonless night the stars are genuinely startling, spilled thick from one horizon to the other with the pale smear of the galaxy running through them. It is the kind of sky people drive a long way to find, and here it is simply what happens when the sun goes down.",
          "You do not need anywhere special to see it, only a spot away from the lights and a few minutes for your eyes to adjust. Lie back on a warm terrace, or on the grass, and let the sky do its work. If your visit falls around the middle of August, you catch the region at its most magical, on the night the Italians link to falling stars, when the whole country goes outdoors to watch the summer sky throw sparks. Make a wish if you are so inclined. The setting rather encourages it. And the estate hill, high and dark and open, is one of the finest places to lie back and take it all in.",
        ],
        image: romanticmaremmaImg3,
        imageAlt: "Look Up — A Romantic Evening in Maremma",
      },
      {
        heading: "Home Advantage",
        slug: "home-advantage",
        body: [
          "For all the charms of the region, some of the most romantic hours are the ones you never leave the estate for. The villa was built with couples in mind, and it shows. There is a suite made for two that comes with its own private plunge pool, screened away for those who would rather not share the property with another soul, which is exactly the right instinct on the right evening. There is the infinity pool, quiet and glimmering after dark, that seems to pour off the edge of the hill toward the sea. And there is the terrace, where a dinner for two under the open sky, with the valley black below and the candles flickering, is hard to improve upon.",
          "This is where a little forethought pays off. A private dinner arranged on your own terrace, cooked and served so that neither of you has to lift a finger. A bottle of the estate's own oil and a board of local things to share. Breakfast brought out into the morning sun for a slow, unhurried start. These are the touches that turn a stay into a memory, and they are exactly the kind of thing we are glad to arrange. The hill provides the setting for free. We can handle the rest.",
        ],
        image: romanticmaremmaImg5,
        imageAlt: "Home Advantage — A Romantic Evening in Maremma",
      },
      {
        heading: "Marking the Moment",
        slug: "marking-the-moment",
        body: [
          "Some evenings carry more weight than others, and the Maremma is a fine place to mark them. We have hosted our share of anniversaries, honeymoons, and the occasional nervous soul with a ring in his pocket, and we have learned that the best of these occasions are the simplest. A quiet table in the right spot. A walk under the stars. A moment on the terrace with the whole valley laid out below. You do not need fireworks. The place supplies the grandeur, and all you have to do is show up and be present in it, together.",
          "A few plain thoughts to end on. Book the small restaurants ahead, since the intimate tables are few and go quickly, especially in summer. Keep the evening loose rather than over-scheduled, because romance does not respond well to a tight itinerary. Bring a light layer for the after-dinner walk and the stargazing, as the hills cool once the sun is gone. And tell us, quietly, if there is an occasion in play, whether it is a decade together or a question about to be asked, and we will do what we can to help the evening land the way you are hoping, without ever making a production of it.",
          "The Maremma will not perform romance for you. It does something better. It simply gives you the ingredients, the candle and the square and the sky, and then it steps back and lets the two of you get on with it. On a warm, dark, star-filled night on this hill, that is more than enough. It always has been.",
        ],
        image: romanticmaremmaImg4,
        imageAlt: "Marking the Moment — A Romantic Evening in Maremma",
      },
    ],
    faqs: [
      {
        q: "Where are the best restaurants for a romantic dinner?",
        a: "The tiny osterias in the medieval lanes of Massa Marittima are wonderfully intimate, and a few seafront restaurants on the coast set their tables at the edge of the sand. Country trattorias with pergola terraces are lovely too. Book ahead, as the best small tables go quickly.",
      },
      {
        q: "Can we order wine with a candlelit dinner?",
        a: "Not at present. Italy is under a temporary rule pausing the serving of alcohol, which restaurants observe. The atmosphere of a candlelit Maremma dinner needs no help from the wine list, and the pouring will return in time.",
      },
      {
        q: "Is the Maremma good for stargazing?",
        a: "Very. Away from city lights, the night sky is remarkably clear and full, especially on moonless nights. The estate hill is an excellent spot, and mid-August brings the famous night of shooting stars.",
      },
      {
        q: "What romantic touches can the villa arrange?",
        a: "Private dinners on your own terrace, a suite with a secluded plunge pool, breakfast in the morning sun, and quiet help marking anniversaries, honeymoons, and proposals. Let us know the occasion and we will shape the evening around it.",
      },
      {
        q: "Do we need a car for a romantic evening out?",
        a: "For dinners in town or on the coast, yes, though many of the loveliest moments happen at the villa itself. When the current rule on alcohol lifts, we are glad to arrange a driver so an evening out can run without a worry about the drive home.",
      },
    ],
    tags: ["romance", "couples", "maremma", "dining", "stargazing", "villa dolce vita"],
  },
];

/** Teasers for homepage + journal index (same objects, thinner surface). */
export const journalTeasers = journal.map(
  ({ slug, title, category, image, imageAlt, excerpt }) => ({
    slug,
    title,
    category,
    image,
    imageAlt,
    excerpt,
  }),
);

export const journalIntro =
  "A running local guide, not a press release: things to do nearby, day trips, and life at the estate. Updated as often as there's something worth writing about.";

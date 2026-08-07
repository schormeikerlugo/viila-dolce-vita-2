/* ==========================================================================
   testimonials.ts — Guest reviews.
   Verbatim 5-star Google reviews for Villa Dolce Vita (lightly trimmed for
   the carousel; minor typo fixes only). Source: the estate's Google listing.
   ========================================================================== */

export interface Testimonial {
  quote: string;
  author: string;
  /** Guest home country / region shown beneath the author. */
  location?: string;
  /** Star rating out of 5. Defaults to 5 when omitted. */
  rating?: number;
  meta?: string;
}

export const testimonials: Testimonial[] = [
  {
    quote:
      "We visited Villa Dolce Vita in September 2025. This is the perfect place to relax and enjoy the views of Tuscany with the rolling hills of vineyards and olive groves. You can also see the sea off in the distance. The apartments are well equipped and the beds by far were the most comfortable I've had our entire vacation. There is a charming medieval town 5 mins away called Massa Marittima that has shops and restaurants. The place exceeded my expectations. We'd come back again next time we are in Italy!",
    author: "Tylor Volk",
    rating: 5,
    meta: "10 months ago",
  },
  {
    quote:
      "Spent an amazing four days and four nights at La Villa Dolce Vita and couldn't have asked for a more perfect, relaxing stay! The property is stunning and situated on green rolling hills, lined with trees and colorful flowers. Of course, there is the added bonus of the owners' adorable pups, Capri and Santo, roaming around that make the villa feel like home. Our hosts, Linda and Frank, were extremely friendly and accommodating. We stayed in the Roma suite, which was equipped with all we needed to make our stay unforgettable. If you're looking for a quiet, relaxing getaway in the Tuscan countryside, then this is the place for you!",
    author: "Melinda Schiano di Cola",
    rating: 5,
    meta: "11 months ago",
  },
  {
    quote:
      "Upon arrival at this Tuscan paradise, we were warmly welcomed with a chilled bottle of Prosecco, personally selected by the owners. The décor was stunning, with every detail thoughtfully curated. The outdoor gym was fully equipped, and the sauna afterward was a perfect way to unwind. Our hosts, Francesco and Linda, were exceptionally helpful, generous, and truly welcoming. A fantastic destination to enjoy the peaceful Tuscan landscape, while still being within easy reach of places like San Gimignano, Siena, and Florence.",
    author: "Angela Marra",
    rating: 5,
    meta: "11 months ago",
  },
  {
    quote:
      "Absolutely stunning villa! From the moment we arrived, everything felt like a dream — the views, the peaceful surroundings, and the charm of the property were beyond anything we imagined. Every detail was perfect, and the atmosphere made it feel both luxurious and welcoming. I genuinely cannot wait to come back again — this is the place where I want to renew my vows. It's that special. Highly recommend to anyone looking for a truly unforgettable stay in Tuscany!",
    author: "Jacqueline Spackman",
    rating: 5,
    meta: "a year ago",
  },
  {
    quote:
      "Our stay was amazing!! I really needed a week of relaxation, just me and my husband. This place was magical. Linda and Frank were the kindest people and made us feel like family. The rooms are spotless and the outside was to die for. I love that they had a cute little gym outside in the sunshine for me to get my exercise in. The sunsets at the villa are also a dream come true. We even explored the little towns nearby. The cutest! Thanks so much Linda and Frank! I can't wait to go back!",
    author: "Maria Lubrano",
    rating: 5,
    meta: "10 months ago",
  },
  {
    quote:
      "Villa Dolce Vita offers the perfect balance of luxury, privacy, and authentic Italian charm. Spending our days by the stunning pool with a glass of exceptional local Tuscan wine was pure bliss. Every detail was thoughtfully curated, but the highlight was the beautiful picnic set up just for our group — filled with authentic Tuscan delicacies, fresh local cheeses, cured meats, artisan bread, seasonal fruit, and regional specialties. A must-visit if you find yourself in Tuscany.",
    author: "Diana Moravska",
    rating: 5,
    meta: "a week ago",
  },
];

/**
 * The tables behind `spoken.js`: numbers, letters and borrowed words, as each
 * language says them.
 *
 * A voice model knows its own script and nothing else. Hand it "2 + 3" and it
 * says nothing; hand the Hindi voice "A for Apple" and it skips two words out
 * of three. So before a line is spoken, everything outside the language's own
 * script is replaced with how a teacher would say it aloud.
 *
 * Odia and Marathi here were written without a native speaker in the room.
 * They are the first thing a reviewer should read — see docs on narration.
 */

export const NUMBERS = {
  hi: 'शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पंचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे सौ'.split(' '),
  mr: 'शून्य एक दोन तीन चार पाच सहा सात आठ नऊ दहा अकरा बारा तेरा चौदा पंधरा सोळा सतरा अठरा एकोणीस वीस एकवीस बावीस तेवीस चोवीस पंचवीस सव्वीस सत्तावीस अठ्ठावीस एकोणतीस तीस एकतीस बत्तीस तेहतीस चौतीस पस्तीस छत्तीस सदतीस अडतीस एकोणचाळीस चाळीस एक्केचाळीस बेचाळीस त्रेचाळीस चव्वेचाळीस पंचेचाळीस सेहेचाळीस सत्तेचाळीस अठ्ठेचाळीस एकोणपन्नास पन्नास एक्कावन्न बावन्न त्रेपन्न चोपन्न पंचावन्न छप्पन्न सत्तावन्न अठ्ठावन्न एकोणसाठ साठ एकसष्ट बासष्ट त्रेसष्ट चौसष्ट पासष्ट सहासष्ट सदुसष्ट अडुसष्ट एकोणसत्तर सत्तर एक्काहत्तर बाहत्तर त्र्याहत्तर चौऱ्याहत्तर पंच्याहत्तर शहात्तर सत्याहत्तर अठ्ठ्याहत्तर एकोणऐंशी ऐंशी एक्क्याऐंशी ब्याऐंशी त्र्याऐंशी चौऱ्याऐंशी पंच्याऐंशी शहाऐंशी सत्त्याऐंशी अठ्ठ्याऐंशी एकोणनव्वद नव्वद एक्क्याण्णव ब्याण्णव त्र्याण्णव चौऱ्याण्णव पंच्याण्णव शहाण्णव सत्त्याण्णव अठ्ठ्याण्णव नव्व्याण्णव शंभर'.split(' '),
  or: 'ଶୂନ ଏକ ଦୁଇ ତିନି ଚାରି ପାଞ୍ଚ ଛଅ ସାତ ଆଠ ନଅ ଦଶ ଏଗାର ବାର ତେର ଚଉଦ ପନ୍ଦର ଷୋହଳ ସତର ଅଠର ଉଣେଇଶ କୋଡ଼ିଏ ଏକୋଇଶ ବାଇଶ ତେଇଶ ଚବିଶ ପଚିଶ ଛବିଶ ସତେଇଶ ଅଠେଇଶ ଅଣତିରିଶ ତିରିଶ ଏକତିରିଶ ବତିଶ ତେତିଶ ଚଉତିରିଶ ପଇଁତିରିଶ ଛତିଶ ସଇଁତିରିଶ ଅଠତିରିଶ ଅଣଚାଳିଶ ଚାଳିଶ ଏକଚାଳିଶ ବୟାଳିଶ ତେୟାଳିଶ ଚଉରାଳିଶ ପଇଁଚାଳିଶ ଛୟାଳିଶ ସତଚାଳିଶ ଅଠଚାଳିଶ ଅଣଚାଶ ପଚାଶ ଏକାବନ ବାଉନ ତେପନ ଚଉବନ ପଞ୍ଚାବନ ଛପନ ସତାବନ ଅଠାବନ ଅଣଷଠି ଷାଠିଏ ଏକଷଠି ବାଷଠି ତେଷଠି ଚଉଷଠି ପଞ୍ଚଷଠି ଛଅଷଠି ସତଷଠି ଅଠଷଠି ଅଣସ୍ତରି ସତୁରି ଏକସ୍ତରି ବାସ୍ତରି ତେସ୍ତରି ଚଉସ୍ତରି ପଞ୍ଚସ୍ତରି ଛଅସ୍ତରି ସତସ୍ତରି ଅଠସ୍ତରି ଅଣାଅଶୀ ଅଶୀ ଏକାଅଶୀ ବୟାଅଶୀ ତେୟାଅଶୀ ଚଉରାଅଶୀ ପଞ୍ଚାଅଶୀ ଛୟାଅଶୀ ସତାଅଶୀ ଅଠାଅଶୀ ଅଣାନବେ ନବେ ଏକାନବେ ବୟାନବେ ତେୟାନବେ ଚଉରାନବେ ପଞ୍ଚାନବେ ଛୟାନବେ ସତାନବେ ଅଠାନବେ ଅନେଶ୍ୱତ ଶହେ'.split(' '),
};

/** How a sum is read aloud. */
export const SIGNS = {
  en: { '+': 'plus', '−': 'minus', '×': 'times', '÷': 'divided by', '=': 'equals', '<': 'is less than', '>': 'is greater than' },
  hi: { '+': 'जमा', '−': 'घटा', '×': 'गुणा', '÷': 'भाग', '=': 'बराबर', '<': 'से छोटा', '>': 'से बड़ा' },
  mr: { '+': 'अधिक', '−': 'वजा', '×': 'गुणिले', '÷': 'भागिले', '=': 'बरोबर', '<': 'पेक्षा लहान', '>': 'पेक्षा मोठा' },
  or: { '+': 'ଯୁକ୍ତ', '−': 'ବିଯୁକ୍ତ', '×': 'ଗୁଣନ', '÷': 'ଭାଗ', '=': 'ସମାନ', '<': 'ଠାରୁ ଛୋଟ', '>': 'ଠାରୁ ବଡ଼' },
};

/** The names of the English letters, as each script writes them. */
const DEVANAGARI_LETTERS = 'ए बी सी डी ई एफ़ जी एच आई जे के एल एम एन ओ पी क्यू आर एस टी यू वी डब्ल्यू एक्स वाई ज़ेड'.split(' ');
export const LETTERS = {
  en: 'ay bee see dee ee eff jee aitch eye jay kay ell em en oh pee cue ar ess tee you vee double-you ex why zed'.split(' '),
  hi: DEVANAGARI_LETTERS,
  mr: DEVANAGARI_LETTERS,
  or: 'ଏ ବି ସି ଡି ଇ ଏଫ ଜି ଏଚ ଆଇ ଜେ କେ ଏଲ ଏମ ଏନ ଓ ପି କ୍ୟୁ ଆର ଏସ ଟି ୟୁ ଭି ଡବ୍ଲ୍ୟୁ ଏକ୍ସ ୱାଇ ଜେଡ'.split(' '),
};

/**
 * English words that turn up inside a Hindi, Marathi or Odia line — "A से
 * Apple", "गाय की आवाज़ — moo" — spelt the way they sound. Lower-case keys.
 */
const DEVANAGARI_WORDS = {
  apple: 'ऐपल', banana: 'बनाना', cat: 'कैट', dog: 'डॉग', elephant: 'एलिफ़ेंट', fish: 'फ़िश', goat: 'गोट', hen: 'हेन',
  ice: 'आइस', cream: 'क्रीम', jeep: 'जीप', kite: 'काइट', lion: 'लायन', monkey: 'मंकी', nest: 'नेस्ट', orange: 'ऑरेंज',
  parrot: 'पैरट', queen: 'क्वीन', rocket: 'रॉकेट', sun: 'सन', tiger: 'टाइगर', umbrella: 'अम्ब्रेला', violin: 'वायलिन',
  watermelon: 'वॉटरमेलन', xylophone: 'ज़ाइलोफ़ोन', yarn: 'यार्न', zebra: 'ज़ेबरा', bus: 'बस', cup: 'कप', go: 'गो',
  in: 'इन', no: 'नो', on: 'ऑन', up: 'अप', we: 'वी', the: 'द', banyan: 'बैनियन', building: 'बिल्डिंग',
  crocodile: 'क्रोकोडाइल', easy: 'ईज़ी', house: 'हाउस', lotus: 'लोटस', mind: 'माइंड', playful: 'प्लेफ़ुल',
  purpose: 'पर्पस', python: 'पाइथन', salt: 'सॉल्ट', shine: 'शाइन', tap: 'टैप', tree: 'ट्री', water: 'वॉटर',
  yesterday: 'येस्टरडे', moo: 'मूँ', bleat: 'में में', neigh: 'हिन हिन', cluck: 'कुड़ कुड़',
  // The phonics sounds: the bare consonant, which is exactly what "buh" is trying to write.
  a: 'ऐ', buh: 'ब', kuh: 'क', duh: 'ड', eh: 'ए', fuh: 'फ़', guh: 'ग', huh: 'ह', ih: 'इ', juh: 'ज', luh: 'ल', muh: 'म',
  nuh: 'न', oh: 'ऑ', puh: 'प', kwuh: 'क्व', ruh: 'र', sss: 'स', tuh: 'ट', uh: 'अ', vuh: 'व', wuh: 'व', ks: 'क्स', yuh: 'य', zuh: 'ज़',
};

export const WORDS = {
  hi: DEVANAGARI_WORDS,
  mr: { ...DEVANAGARI_WORDS, apple: 'ॲपल', cat: 'कॅट', tap: 'टॅप', parrot: 'पॅरट', banyan: 'बॅनियन' },
  or: {
    apple: 'ଆପଲ', banana: 'ବନାନା', cat: 'କ୍ୟାଟ', dog: 'ଡଗ', elephant: 'ଏଲିଫାଣ୍ଟ', fish: 'ଫିସ', goat: 'ଗୋଟ', hen: 'ହେନ',
    ice: 'ଆଇସ', cream: 'କ୍ରିମ', jeep: 'ଜିପ', kite: 'କାଇଟ', lion: 'ଲାୟନ', monkey: 'ମଙ୍କି', nest: 'ନେଷ୍ଟ', orange: 'ଅରେଞ୍ଜ',
    parrot: 'ପ୍ୟାରଟ', queen: 'କୁଇନ', rocket: 'ରକେଟ', sun: 'ସନ', tiger: 'ଟାଇଗର', umbrella: 'ଅମ୍ବ୍ରେଲା', violin: 'ଭାୟୋଲିନ',
    watermelon: 'ୱାଟରମେଲନ', xylophone: 'ଜାଇଲୋଫୋନ', yarn: 'ୟାର୍ନ', zebra: 'ଜେବ୍ରା', bus: 'ବସ', cup: 'କପ', go: 'ଗୋ',
    in: 'ଇନ', no: 'ନୋ', on: 'ଅନ', up: 'ଅପ', we: 'ୱି', the: 'ଦ', moo: 'ହମ୍ବା', bleat: 'ମେଁ ମେଁ', neigh: 'ହିଁ ହିଁ', cluck: 'କକ୍ କକ୍',
    a: 'ଆ', buh: 'ବ', kuh: 'କ', duh: 'ଡ', eh: 'ଏ', fuh: 'ଫ', guh: 'ଗ', huh: 'ହ', ih: 'ଇ', juh: 'ଜ', luh: 'ଲ', muh: 'ମ',
    nuh: 'ନ', oh: 'ଅ', puh: 'ପ', kwuh: 'କ୍ୱ', ruh: 'ର', sss: 'ସ', tuh: 'ଟ', uh: 'ଅ', vuh: 'ଭ', wuh: 'ୱ', ks: 'କ୍ସ', yuh: 'ୟ', zuh: 'ଜ',
  },
};

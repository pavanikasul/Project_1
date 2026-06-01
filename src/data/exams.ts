export interface Question {
  id: number;
  text: string;
  options: string[];
  type: 'MCQ' | 'MSQ' | 'TF' | 'FIB';
  answer: any;
  section?: string;
}

export interface Section {
  id: string;
  title: string;
  questions: Question[];
}

export const QUESTION_BANK: Record<string, Omit<Question, 'id'>[]> = {
  'Numerical Reasoning': [
    { text: "If a boat travels 15 km/h in still water and the current is 3 km/h, what is its downstream speed?", options: ["12 km/h", "18 km/h", "15 km/h", "21 km/h"], type: "MCQ", answer: "18 km/h" },
    { text: "Select the prime numbers from the following list:", options: ["11", "15", "17", "21", "23"], type: "MSQ", answer: ["11", "17", "23"] },
    { text: "A square with side 5cm has a larger area than a circle with radius 2cm. (π ≈ 3.14)", options: ["True", "False"], type: "TF", answer: "True" },
    { text: "If 3x + 7 = 22, the value of x is ____.", options: [], type: "FIB", answer: "5" },
    { text: "Which of the following are multiples of 8?", options: ["16", "24", "30", "48", "54"], type: "MSQ", answer: ["16", "24", "48"] },
    { text: "The sum of the internal angles of a triangle is 180 degrees.", options: ["True", "False"], type: "TF", answer: "True" },
    { text: "The next number in the sequence 2, 4, 8, 16 is ____.", options: [], type: "FIB", answer: "32" },
    { text: "A train 100m long travels at 36 km/h. How long (in seconds) will it take to cross a pole?", options: ["5", "10", "15", "20"], type: "MCQ", answer: "10" },
    { text: "Which of these are perfect squares?", options: ["16", "24", "36", "48", "64"], type: "MSQ", answer: ["16", "36", "64"] },
    { text: "A rectangle with length 8 and width 4 has a perimeter of ____.", options: [], type: "FIB", answer: "24" },
    { text: "If the cost of 5 pens is Rs. 50, then the cost of 12 pens is Rs. 120.", options: ["True", "False"], type: "TF", answer: "True" },
    { text: "Solve for y: 2y - 10 = 0. The value of y is ____.", options: [], type: "FIB", answer: "5" },
    { text: "Which fractions are equivalent to 1/2?", options: ["2/4", "3/6", "4/10", "5/10", "6/15"], type: "MSQ", answer: ["2/4", "3/6", "5/10"] },
    { text: "What is 25% of 200?", options: ["25", "50", "75", "100"], type: "MCQ", answer: "50" },
    { text: "The product of 0.5 and 0.5 is 0.25.", options: ["True", "False"], type: "TF", answer: "True" },
    { text: "What is the HCF of 12 and 18?", options: ["2", "3", "6", "9"], type: "MCQ", answer: "6" },
    { text: "Find the average of 10, 20, 30, 40, 50. The average is ____.", options: [], type: "FIB", answer: "30" },
    { text: "Is 81 a perfect cube?", options: ["True", "False"], type: "TF", answer: "False" },
    { text: "Which of these are factors of 20?", options: ["2", "4", "5", "8", "10"], type: "MSQ", answer: ["2", "4", "5", "10"] },
    { text: "The square of 13 is ____.", options: [], type: "FIB", answer: "169" }
  ],
  'Verbal Reasoning': [
    { text: "Choose the synonym for 'ABANDON':", options: ["Keep", "Leave", "Hold", "Adopt"], type: "MCQ", answer: "Leave" },
    { text: "Select all the synonyms for 'HAPPY':", options: ["Joyful", "Sorrowful", "Cheerful", "Gloomy", "Content"], type: "MSQ", answer: ["Joyful", "Cheerful", "Content"] },
    { text: "The word 'Exuberant' is an antonym of 'Lethargic'.", options: ["True", "False"], type: "TF", answer: "True" },
    { text: "The plural of 'Child' is ____.", options: [], type: "FIB", answer: "children" },
    { text: "Identify the nouns in this list:", options: ["Run", "Happiness", "Quickly", "Mountain", "Blue"], type: "MSQ", answer: ["Happiness", "Mountain"] },
    { text: "A 'Fable' is a long non-fictional scientific report.", options: ["True", "False"], type: "TF", answer: "False" },
    { text: "The past tense of the verb 'Go' is ____.", options: [], type: "FIB", answer: "went" },
    { text: "Identify the correctly spelled word:", options: ["Accomodate", "Accommodate", "Acomodate", "Accomoddat"], type: "MCQ", answer: "Accommodate" },
    { text: "Select the vowels from the following letters:", options: ["B", "E", "G", "I", "T", "U"], type: "MSQ", answer: ["E", "I", "U"] },
    { text: "The sentence 'He don't like tea' is grammatically correct.", options: ["True", "False"], type: "TF", answer: "False" },
    { text: "Complete the proverb: 'Actions speak louder than ____.'", options: [], type: "FIB", answer: "words" },
    { text: "Choose the antonym for 'ANCIENT':", options: ["Old", "Modern", "Classic", "Antique"], type: "MCQ", answer: "Modern" },
    { text: "Select all adjectives in this set:", options: ["Table", "Fast", "Read", "Beautiful", "Softly"], type: "MSQ", answer: ["Fast", "Beautiful"] },
    { text: "A 'Cacophony' refers to a very pleasant and melodic sound.", options: ["True", "False"], type: "TF", answer: "False" },
    { text: "The word '____' means a person who looks at the bright side of things.", options: [], type: "FIB", answer: "optimist" },
    { text: "Which of these is a preposition?", options: ["But", "And", "Between", "Quickly"], type: "MCQ", answer: "Between" },
    { text: "Which words are related to 'Education'?", options: ["School", "Hammer", "Teacher", "Curriculum", "Wrench"], type: "MSQ", answer: ["School", "Teacher", "Curriculum"] },
    { text: "An 'Anagram' is a word formed by rearranging the letters of another word.", options: ["True", "False"], type: "TF", answer: "True" },
    { text: "Fill in the blank: She is ___ honest person.", options: [], type: "FIB", answer: "an" },
    { text: "Meaning of 'Break the ice'?", options: ["To start a fight", "To start a conversation", "To end a relationship", "To cause an accident"], type: "MCQ", answer: "To start a conversation" }
  ],
  'Logical Reasoning': [
    { text: "If 'COB' is coded as 3152, how is 'DOG' coded?", options: ["4157", "4168", "5157", "4158"], type: "MCQ", answer: "4157" },
    { text: "Identify the logic: 'A is older than B. B is older than C. Therefore, A is older than C.'", options: ["True", "False"], type: "TF", answer: "True" },
    { text: "Select the words that follow the pattern 'T-E-R-M':", options: ["TEAM", "TERM", "TURN", "TRAM", "TORM"], type: "MSQ", answer: ["TEAM", "TERM", "TRAM", "TORM"] },
    { text: "If Friday is the 4th of the month, the 11th will be ____.", options: [], type: "FIB", answer: "Friday" },
    { text: "Which of the following are odd one out candidates?", options: ["Square", "Circle", "Triangle", "Cube", "Sphere"], type: "MSQ", answer: ["Cube", "Sphere"] },
    { text: "In a family, A is the brother of B. B is the mother of C. A is the uncle of C.", options: ["True", "False"], type: "TF", answer: "True" },
    { text: "The next term in the series A, C, E, G is ____.", options: [], type: "FIB", answer: "I" },
    { text: "Find the odd one out:", options: ["Car", "Bus", "Train", "Bicycle"], type: "MCQ", answer: "Bicycle" },
    { text: "If 'RED' is 'BLUE' and 'BLUE' is 'GREEN', then clear sky is 'BLUE'.", options: ["True", "False"], type: "TF", answer: "False" },
    { text: "Which of these are prime colors?", options: ["Red", "Green", "Blue", "Yellow", "Orange"], type: "MSQ", answer: ["Red", "Blue", "Yellow"] },
    { text: "If 1+1=5 and 2+2=20, then 3+3 = ____.", options: [], type: "FIB", answer: "45" },
    { text: "Look at this series: 7, 10, 8, 11, 9, 12, ... What number should come next?", options: ["7", "10", "12", "13"], type: "MCQ", answer: "10" },
    { text: "Select all that are NOT polygons:", options: ["Circle", "Triangle", "Oval", "Pentagon", "Cylinder"], type: "MSQ", answer: ["Circle", "Oval", "Cylinder"] },
    { text: "A doctor gives you 3 pills and tells you to take one every 30 minutes. They will last 90 minutes.", options: ["True", "False"], type: "TF", answer: "False" },
    { text: "The opposite of 'North-West' is ____.", options: [], type: "FIB", answer: "South-East" },
    { text: "A is taller than B, B is taller than C. Who is the tallest?", options: ["A", "B", "C", "Cannot say"], type: "MCQ", answer: "A" },
    { text: "Is the number of days in February always 28?", options: ["True", "False"], type: "TF", answer: "False" },
    { text: "Which shapes have exactly 4 sides?", options: ["Square", "Rectangle", "Rhombus", "Trapezium", "Hexagon"], type: "MSQ", answer: ["Square", "Rectangle", "Rhombus", "Trapezium"] },
    { text: "If you are running a race and pass the person in second place, you are in ____ place.", options: [], type: "FIB", answer: "second" },
    { text: "Which word does NOT belong?", options: ["Tyre", "Steering wheel", "Engine", "Car"], type: "MCQ", answer: "Car" }
  ],
  'General Awareness': [
    { text: "Which country hosted the G20 Summit in 2023?", options: ["India", "Brazil", "Indonesia", "South Africa"], type: "MCQ", answer: "India" },
    { text: "Select the successful lunar missions by ISRO:", options: ["Chandrayaan-1", "Chandrayaan-2", "Chandrayaan-3", "Apollo 11", "Artemis 1"], type: "MSQ", answer: ["Chandrayaan-1", "Chandrayaan-2", "Chandrayaan-3"] },
    { text: "Artificial Intelligence (AI) can learn and adapt through Machine Learning algorithms.", options: ["True", "False"], type: "TF", answer: "True" },
    { text: "The first Indian to win an Oscar was ____.", options: [], type: "FIB", answer: "Bhanu Athaiya" },
    { text: "Which of these countries recently joined NATO in 2023/2024?", options: ["Sweden", "Finland", "Ukraine", "Serbia"], type: "MSQ", answer: ["Sweden", "Finland"] },
    { text: "ChatGPT is an AI language model developed by Google.", options: ["True", "False"], type: "TF", answer: "False" },
    { text: "The capital city of the newest state in India (Telangana) is ____.", options: [], type: "FIB", answer: "Hyderabad" },
    { text: "Which team won the ICC Men's Cricket World Cup in 2023?", options: ["India", "Australia", "England", "South Africa"], type: "MCQ", answer: "Australia" },
    { text: "Select all the companies that are part of the 'Magnificent Seven' tech stocks:", options: ["Apple", "Microsoft", "Intel", "NVIDIA", "IBM"], type: "MSQ", answer: ["Apple", "Microsoft", "NVIDIA"] },
    { text: "Electric vehicles (EVs) produce zero direct tailpipe emissions.", options: ["True", "False"], type: "TF", answer: "True" },
    { text: "The current Prime Minister of the UK (as of late 2023) is Rishi ____.", options: [], type: "FIB", answer: "Sunak" },
    { text: "Who won the Nobel Peace Prize in 2023?", options: ["Narges Mohammadi", "Malala Yousafzai", "Greta Thunberg", "Denis Mukwege"], type: "MCQ", answer: "Narges Mohammadi" },
    { text: "Which of these are major greenhouse gases?", options: ["Carbon Dioxide", "Oxygen", "Methane", "Nitrous Oxide", "Argon"], type: "MSQ", answer: ["Carbon Dioxide", "Methane", "Nitrous Oxide"] },
    { text: "The James Webb Space Telescope was launched to replace the Hubble Space Telescope.", options: ["True", "False"], type: "TF", answer: "True" },
    { text: "The currency of the United Kingdom is the ____.", options: [], type: "FIB", answer: "Pound" },
    { text: "What is the largest organ in the human body?", options: ["Heart", "Brain", "Liver", "Skin"], type: "MCQ", answer: "Skin" },
    { text: "Select the major modern AI models available to the public:", options: ["GPT-4", "Claude 3", "Gemini", "Windows 95", "Internet Explorer"], type: "MSQ", answer: ["GPT-4", "Claude 3", "Gemini"] },
    { text: "India successfully landed Chandrayaan-3 on the North Pole of the Moon.", options: ["True", "False"], type: "TF", answer: "False" },
    { text: "The author of the 'Harry Potter' series is J.K. ____.", options: [], type: "FIB", answer: "Rowling" },
    { text: "Which movie won the Academy Award for Best Picture in 2024?", options: ["Oppenheimer", "Barbie", "Poor Things", "Killers of the Flower Moon"], type: "MCQ", answer: "Oppenheimer" }
  ]
};

export const EXAM_SECTIONS = [
  { id: 'sec-1', title: 'Section-I: Numerical Reasoning' },
  { id: 'sec-2', title: 'Section-II: Verbal Reasoning' },
  { id: 'sec-3', title: 'Section-III: Logical Reasoning' },
  { id: 'sec-4', title: 'Section-IV: General Awareness' }
];

export const EXAM_SETS = [
  { id: 'set-a', title: 'Aptitude Edge' }
];


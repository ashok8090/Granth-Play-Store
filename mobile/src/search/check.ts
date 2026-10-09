import type { Topic } from "../models/types";
import { calculateRelevance, searchTopics } from "./SearchService.ts";

const topics: Topic[] = [
  {
    id: "1",
    title: "मांस खाने वाले को नरक मिलता है",
    description: "मांस भक्षण",
    position: "1",
    user: "",
    created_at: "",
    granth_count: "1",
    praman_count: "2",
  },
  {
    id: "2",
    title: "गीता का सार",
    description: "कृष्ण अर्जुन संवाद",
    position: "2",
    user: "",
    created_at: "",
    granth_count: "1",
    praman_count: "1",
  },
  {
    id: "3",
    title: "कबीर के दोहे",
    description: "साखी",
    position: "3",
    user: "",
    created_at: "",
    granth_count: "1",
    praman_count: "1",
  },
];

function assert(cond: boolean, message: string): void {
  if (!cond) {
    console.error("FAIL", message);
    process.exit(1);
  }
}

const mans = searchTopics(topics, "mans");
assert(mans.some((row) => row.title.includes("मांस")), "mans should find मांस");

const gita = searchTopics(topics, "geeta");
assert(gita.some((row) => row.title.includes("गीता")), "geeta should find गीता");

const kabir = searchTopics(topics, "kabeer");
assert(kabir.some((row) => row.title.includes("कबीर")), "kabeer should find कबीर");

const death = calculateRelevance("mrityu", ["मृत्यु के बाद क्या"]);
assert(death >= 60, `mrityu score ${death}`);

const brahma = calculateRelevance("brahm", ["ब्रह्म ज्ञान"]);
assert(brahma >= 60, `brahm score ${brahma}`);

const phrase = calculateRelevance("ब्रह्मा की मृत्यु", ["सृष्टि के बाद मृत्यु और ब्रह्मा का प्रसंग"]);
assert(phrase >= 50, `phrase score ${phrase}`);

const krishna = calculateRelevance("krishna", ["कृष्ण"]);
assert(krishna >= 60, `krishna score ${krishna}`);

console.log("search ok", { mans: mans[0]?.title, death, brahma, phrase, krishna });

import { Gauge, Icons } from "pierre";

const linkToHeyGauge = new Gauge("Docs", {
  icon: Icons.Link,
  color: "blue",
  href: "https://hey.xyz"
});

const linkToHey = async () => {
  linkToHeyGauge.update({ value: 1 });
};

export default [linkToHey];
import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';
import { FPGrowth, Itemset } from 'node-fpgrowth';
import { clearScreenDown } from 'node:readline';

const convert = () => {
  const raw = readFileSync('./data/raw.json').toString();
  return JSON.parse(raw);
};

const data = convert();

interface IEmployeeName2ID {
  [name: string]: number;
};

interface IGroupName2ID {
  [name: string]: number;
}

interface IGoodName2ID {
  [name: string]: {
    id: number;
    group: number;
  }
};

interface ITransaction {
  date: number;
  check: number;
  employee: number;
  positions: number[];
};

const employeesName2ID: IEmployeeName2ID = {};
const groupsName2ID: IGroupName2ID = {};
const goodsName2ID: IGoodName2ID = {};
let transactions: ITransaction[] = [];

let employeId = 0;
let groupId = 0;
let goodId = 0;
let newCheckId = 0;

const stopGroup = ['Сигареты', 'Табачные изделия', 'склад'];
const stopGood = ['Пакет', 'Контейнер'];

const transform = () => {
  let prevCheck = -1;
  let currTr: ITransaction | undefined = undefined;
  for (const r of data.sort( (a, b) => a.check - b.check )) {
    if (prevCheck !== r.check) {
      if (currTr) {
        currTr.positions = [...new Set(currTr.positions)].sort( (a, b) => a - b );

        // min check length!
        if (currTr.positions.length > 3) {
          transactions.push(currTr);
        }
      }

      let employee = employeesName2ID[r.empl] ?? -1;

      if (employee === -1) {
        employee = employeId++;
        employeesName2ID[r.empl] = employee;
      }

      currTr = {
        date: new Date(r.date).getTime(),
        employee,
        check: newCheckId++,
        positions: []
      };

      prevCheck = r.check;
    }

    if (!stopGroup.includes(r.group) && !stopGood.includes(r.good)) {
      let group = groupsName2ID[r.group] ?? -1;

      if (group === -1) {
        group = groupId++;
        groupsName2ID[r.group] = group;
      }

      let good = goodsName2ID[r.good];

      if (!good) {
        good = {
          id: goodId++,
          group
        };
        goodsName2ID[r.good] = good;
      }

      currTr.positions.push(good.id);
    }
  }
};

transform();

const checksByCheckLength = {};

for (const { positions } of transactions) {
  const l = positions.length;
  checksByCheckLength[l] = (checksByCheckLength[l] ?? 0) + 1;
}

const checksByEmployee = {};

for (const { employee } of transactions) {
  checksByEmployee[employee] = (checksByEmployee[employee] ?? 0) + 1;
}

const checkByEmployeeThreshold = 0;

const employees = {};

for (const [name, id] of Object.entries(employeesName2ID)) {
  if (checksByEmployee[id] > checkByEmployeeThreshold) {
    employees[id] = name;
  }
};

transactions = transactions.filter( ({ employee }) => employees[employee] );

const goods = {};

for (const [name, { id }] of Object.entries(goodsName2ID)) {
  goods[id] = name;
};

const groups = {};

for (const [name, id] of Object.entries(groupsName2ID)) {
  groups[id] = name;
};

const goods2groups = {};

for (const { id, group } of Object.values(goodsName2ID)) {
  goods2groups[id] = group;
};

const goodsSupport = {};

for (const { positions } of transactions) {
  for (const p of positions) {
    goodsSupport[p] = (goodsSupport[p] ?? 0) + 1;
  }
};

writeFileSync('../client/public/data/employees.json', JSON.stringify(employees));
writeFileSync('../client/public/data/goods.json', JSON.stringify(goods));
writeFileSync('../client/public/data/goods2groups.json', JSON.stringify(goods2groups));
writeFileSync('../client/public/data/groups.json', JSON.stringify(groups));
writeFileSync('../client/public/data/transactions.json', JSON.stringify(transactions));
writeFileSync('../client/public/data/goodssupport.json', JSON.stringify(goodsSupport));

console.log(`data lines: ${data.length}`);
console.log(`employees: ${Object.keys(employees).length}`);
console.log(`groups: ${Object.keys(groups).length}`);
console.log(`goods: ${Object.keys(goods).length}`);
console.log(`transactions: ${transactions.length}`);
console.log(`checksByLength: ${JSON.stringify(checksByCheckLength, undefined, 2)}`);


// Execute FPGrowth with a minimum support of 40%. Algorithm is generic.
let fpgrowth: FPGrowth<number> = new FPGrowth<number>(.00001);

// Execute FPGrowth on a given set of transactions.
fpgrowth.exec(transactions.map( tr => tr.positions))
  .then( (itemsets: Itemset<number>[]) => {
    const items = itemsets
      .filter( i => i.items.length > 2 && i.support >= 1 )
      .map( i => ({ ...i, items: i.items.sort( (a, b) => a - b ) }) )
      .sort( (a, b) => b.support - a.support );
    writeFileSync('../client/public/data/fp.txt', items
      .map( i => `support: ${i.support.toString().padStart(6)}, items: ${i.items.map( g => goods[g] )}` )
      .join('\n')
    );
    writeFileSync('../client/public/data/fp.json', JSON.stringify(items.map( i => i.items )));
    console.log(`frequent sets: ${items.length}`);
  });
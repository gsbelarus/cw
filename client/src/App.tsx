import React, { useEffect, useState } from 'react';
import './App.css';
import { AppBar, Box, Button, Card, CardContent, createMuiTheme, Grid, Link, List, ListItem, ListItemText, MenuItem, Paper, Select, Tab, Tabs, TextField, ThemeProvider, Typography } from '@material-ui/core';

interface IEmployees {
  [employeeId: string]: string;
};

interface IGoods {
  [goodId: string]: string;
};

interface IGoodsSupport {
  [goodId: string]: number;
};

interface IGoods2Groups {
  [goodId: string]: number;
};

interface IGroups {
  [groupId: string]: string;
};

interface ITransaction {
  date: number;
  check: number;
  employee: number;
  positions: number[];
};

interface IStat {
  xc: number;
  c: number;
  confidence: number;
  lift: number;
};

interface ISuggestion {
  goodId: number;
  stat: IStat;
};

type Transactions = ITransaction[];

const theme = createMuiTheme({
  palette: {
    type: 'light',
  },
  spacing: 8,
});

interface IGoodSelectProps {
  /** справочник товаров */
  goods: [number, string][];
  /** выбранный товар */
  value: number;
  /** массив идентификаторов в других списках, чтобы исключить повторный выбор */
  others: number[];
  /** */
  onChange: (goodId: number) => void;
};

const GoodSelect = ({ goods, value, others, onChange }: IGoodSelectProps) =>
  <Grid item>
    <Select value={value} onChange={ event => typeof event.target.value === 'number' && onChange(event.target.value) } style={{minWidth: 120}}>
      {goods.map( ([goodId, goodName]) => others.includes(goodId) ? undefined : <MenuItem value={goodId}>{goodName}</MenuItem>)}
    </Select>
  </Grid>;

function App() {

  interface IPlayground {
    trNum: number;
    selected: number[];
    suggested: ISuggestion[];
    moves: number;
    method: 'SLOW' | 'FAST';
  };

  const [employees, setEmployees] = useState<string[]>([]);
  const [goods, setGoods] = useState<string[]>([]);
  const [goodsGroups, setGoodsGroups] = useState<number[]>([]);
  const [goodsSupport, setGoodsSupport] = useState<number[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Transactions>([]);
  const [filter, setFilter] = useState('');
  const [filterFP, setFilterFP] = useState('');
  const [sortedGoods, setSortedGoods] = useState<[number, string][]>([]);
  const [antecedent, setAntecedent] = useState<number[]>([]);
  const [consequent, setConsequent] = useState<number[]>([]);
  const [stat, setStat] = useState<IStat>({ xc: 0, c: 0, confidence: 0, lift: 0});
  const [currTab, setCurrTab] = useState(0);
  const [playground, setPlayground] = useState<IPlayground>();
  const [fp, setFP] = useState<number[][]>([]);
  const [considerEmployee, setConsiderEmployee] = useState(false);

  const done = playground && playground.selected.length === transactions[playground.trNum].positions.length;

  useEffect( () => {
    fetch(process.env.PUBLIC_URL + '/data/employees.json')
      .then( data => data.json() )
      .then( obj => setEmployees(Object.entries(obj as IEmployees).reduce( (p, [employeeId, name]) => { p[parseInt(employeeId)] = name; return p; }, [] as string[] )) );

    fetch(process.env.PUBLIC_URL + '/data/goods.json')
      .then( data => data.json() )
      .then( obj => setGoods(Object.entries(obj as IGoods).reduce( (p, [goodId, name]) => { p[parseInt(goodId)] = name; return p; }, [] as string[] )) );

    fetch(process.env.PUBLIC_URL + '/data/goodssupport.json')
      .then( data => data.json() )
      .then( obj => setGoodsSupport(Object.entries(obj as IGoodsSupport).reduce( (p, [goodId, qty]) => { p[parseInt(goodId)] = qty; return p; }, [] as number[] )) );

    fetch(process.env.PUBLIC_URL + '/data/goods2groups.json')
      .then( data => data.json() )
      .then( obj => setGoodsGroups(Object.entries(obj as IGoods2Groups).reduce( (p, [goodId, groupId]) => { p[parseInt(goodId)] = groupId; return p; }, [] as number[] )) );

    fetch(process.env.PUBLIC_URL + '/data/groups.json')
      .then( data => data.json() )
      .then( obj => setGroups(Object.entries(obj as IGroups).reduce( (p, [groupId, name]) => { p[parseInt(groupId)] = name; return p; }, [] as string[] )) );

    fetch(process.env.PUBLIC_URL + '/data/transactions.json')
      .then( data => data.json() )
      .then( json => setTransactions(json) );

    fetch(process.env.PUBLIC_URL + '/data/fp.json')
      .then( data => data.json() )
      .then( json => setFP(json) );
  }, []);

  useEffect(
    () => setSortedGoods((goods.map( (name, goodId) => [goodId, name] ) as [number, string][]).sort( ([_, a], [__, b]) => a.localeCompare(b) ) ),
  [goods]);

  interface IStat {
    xc: number;
    c: number;
    confidence: number;
    lift: number;
  };

  const calcStat = (x: number[], y: number[]): IStat => {
    if (x.includes(y[0])) {
      return {
        xc: 0,
        c: 0,
        confidence: 0,
        lift: 0
      }
    }

    let c = 0;
    let xc = 0;
    let yc = 0;
    const l = transactions.length;

    for (let j = 0; j < transactions.length; j++) {
      const { positions } = transactions[j];

      let foundX = true;

      for (let i = 0; i < x.length; i++) {
        if (!positions.includes(x[i])) {
          foundX = false;
          break;
        }
      }
      if (foundX) {
        xc++;
      }

      let foundY = true;
      for (let i = 0; i < y.length; i++) {
        if (!positions.includes(y[i])) {
          foundY = false;
          break;
        }
      }
      if (foundY) {
        yc++;

        if (foundX) {
          c++;
        }
      }
    }

    return getStat(c, xc, yc, l);
  };

  const getStat = (c: number, xc: number, yc: number, l: number): IStat => ({
    xc,
    c,
    confidence: c / xc,
    lift: (c / l) / ((xc / l) * (yc / l))
  });

  const _getSuggested2 = (selectedInput: number[], fp: number[][]): number[] => {
    const selected = selectedInput.sort( (a, b) => a - b );
    const l = selected.length;
    let res: number[] = [];

    for (let i = 0; i < fp.length && res.length < 100; i++) {
      if (fp[i].length <= selected.length) {
        continue;
      }

      let p = 0;
      let matched = true;
      for (let j = 0; j < l && matched; j++) {
        if (p >= fp[i].length) {
          matched = false;
          break;
        }

        let found = false;
        for (let k = p; k < fp[i].length; k++) {
          if (fp[i][k] === selected[j]) {
            p = k + 1;
            found = true;
            break;
          }

          if (fp[i][k] > selected[j]) {
            matched = false;
            break;
          }
        }

        if (!found) {
          matched = false;
        }
      }
      if (matched) {
        res = [...new Set([...res, ...fp[i].filter( g => !selected.includes(g) )])]
      }
    }

    return res
      .sort( (a, b) => goodsSupport[b] - goodsSupport[a] )
      .slice(0, 10)
      .sort( (a, b) => a - b );
  };

  const getSuggested2 = (selected: number[]): ISuggestion[] => {
    return _getSuggested2(selected, fp).map( r => ({ goodId: r, stat: { xc: 0, c: 0, confidence: 0, lift: 0 } }) );
  };

  const getSuggested = (trNum: number, selected: number[]): ISuggestion[] => {
    const suggested: ISuggestion[] = [];

    let xc = 0;
    const xtr = [];

    for (let j = 0; j < transactions.length; j++) {
      if (j === trNum) {
        continue;
      }

      const { positions } = transactions[j];

      let foundX = true;

      for (let i = 0; i < selected.length; i++) {
        if (!positions.includes(selected[i])) {
          foundX = false;
          break;
        }
      }
      if (foundX) {
        xc++;
        xtr[j] = 1;
      }
    }

    for (let goodId = 0; goodId < goods.length; goodId++) {
      if (selected.includes(goodId)) {
        continue;
      }

      let c = 0;
      let yc = 0;
      const l = transactions.length;

      for (let j = 0; j < transactions.length; j++) {
        const { positions } = transactions[j];

        if (positions.includes(goodId)) {
          yc++;

          if (xtr[j]) {
            c++;
          }
        }
      }

      const stat = getStat(c, xc, yc, l)

      if (stat.confidence > 0.05) {
        suggested.push({
          goodId,
          stat
        });
      }
    }

    return suggested
      .sort(
        (a, b) => {
          const r = b.stat.confidence - a.stat.confidence;
          return r || (b.stat.lift - a.stat.lift);
        }
      )
      .slice(0, 10);
  };

  const getSuggested3 = (trNum: number): ISuggestion[] => {
    if (!considerEmployee) {
      return [];
    }

    const empl = transactions[trNum].employee;

    const fg: { [id: number]: number } = {};

    for (let i = 0; i < trNum; i++) {
      const { employee, positions } = transactions[i];
      if (employee === empl) {
        for (let j = 0; j < positions.length; j++) {
          fg[positions[j]] = (fg[positions[j]] ?? 0) + 1;
        }
      }
    }

    return Object.entries(fg)
      .sort( (a, b) => b[1] - a[1] )
      .slice(0, 10)
      .map( g => parseInt(g[0]) )
      .sort( (a, b) => a - b )
      .map( goodId => ({ goodId, stat: { xc: 0, c: 0, confidence: 0, lift: 0 }}) );
  };

  const getRandomGoodId = () => {
    const stopList = [...antecedent, ...consequent];
    while (goods.length > stopList.length) {
      const id = Math.floor(Math.random() * goods.length);
      if (!stopList.includes(id)) {
        return id;
      }
    }
    return -1;
  };

  interface ITransactionProps {
    trNum: number;
    selected?: number[];
    suggested?: ISuggestion[];
    hideNum?: boolean;
    onClick: (goodId: number) => void;
  };

  const Transaction = ({ trNum, selected, suggested, hideNum, onClick }: ITransactionProps) => {
    const tr = transactions[trNum];
    const num = hideNum ? '' : `#${trNum}, `;
    return (
      tr &&
      <Box>
        <Typography gutterBottom variant="h5" component="h2">
          {num}{new Date(tr.date).toLocaleDateString()}
        </Typography>
        <List>
          {
            tr.positions.map(
              p =>
                <ListItem
                  button
                  onClick={ () => onClick(p) }
                  style={
                    selected?.includes(p)
                    ? { backgroundColor: 'orange' }
                    : suggested?.find(s => s.goodId === p)
                    ? { backgroundColor: 'lime' }
                    : undefined
                  }
                >
                  <ListItemText primary={goods[p]} secondary={selected ? undefined : `${groups[goodsGroups[p]]}, ${goodsSupport[p]}`} />
                </ListItem>
            )
          }
        </List>
      </Box>
    );
  };

  const listFP = () => {
    let res = fp;

    const checkNumber = parseInt(filterFP);

    if (typeof checkNumber === 'number' && checkNumber >= 0 && checkNumber < 20) {
      res = fp.filter( p => p.length === checkNumber );
    }
    else {
      const f = filterFP.split(',').map( s => s.trim().toLowerCase() );

      if (f.length && f[0].length > 2) {
        res = [];
        for (let i = 0; i < fp.length && res.length < 200; i++) {
          if (fp[i].map( p => goods[p] ).find( n => f.find( ss => n.includes(ss) ) ) ) {
            res.push(fp[i]);
          }
        }
      }
    }

    let cut = false;

    if (res.length > 200) {
      res = res.slice(0, 200);
      cut = true;
    }

    return (
      <Box>
        <Typography gutterBottom variant="h5" component="h2">
          {cut ? 'Only top 200 are shown...' : `Found ${res.length} items...`}
        </Typography>
        <List>
          {
            res.map(
              p => <ListItem><ListItemText>{p.map( i => goods[i] ).join(', ')}</ListItemText></ListItem>
            )
          }
        </List>
      </Box>
    );
  };

  const list = () => {
    const res: [ITransaction, number][] = [];
    const checkNumber = parseInt(filter);

    if (typeof checkNumber === 'number' && checkNumber >= 0) {
      if (transactions[checkNumber]) {
        res.push([transactions[checkNumber], checkNumber]);
      }
    }
    else {
      const f = filter.split(',').map( s => s.trim().toLowerCase() );

      if (f.length && f[0].length > 2) {
        const needed = f.map(
          s => goods.reduce( (p, g, idx) => {
            if (g.toLowerCase().includes(s)) {
              p.push(idx);
            }
            return p;
          }, [] as number[])
        );

        transactions.forEach( (tr, idx) => {

          if (res.length > 40) {
            return;
          }

          const { positions } = tr;
          let c = 0;
          for (const n of needed) {
            for (const p of positions) {
              if (n.includes(p)) {
                c++;
                break;
              }
            }
          }
          if (c === needed.length) {
            res.push([tr, idx]);
          }
        });
      }
    }

    return res.map( ([_, trNum]) =>
      <Grid item>
        <Card>
          <CardContent>
            <Transaction
              trNum={trNum}
              onClick={
                goodId => {
                  if (!isNaN(parseInt(filter))) {
                    setFilter(goods[goodId]);
                  } else {
                    setFilter((filter ? (filter + ',') : '') + goods[goodId]);
                  }
                }
              }
            />
          </CardContent>
        </Card>
      </Grid>
    );
  };

  interface IItemListProps {
    seq: number[];
    others: number[];
    setFn: (value: React.SetStateAction<number[]>) => void;
  };

  const ItemList = ({ seq, others, setFn }: IItemListProps) =>
    <Grid container direction="column" spacing={1}>
      {
        seq.map(
          (id, idx) =>
            <GoodSelect
              goods={sortedGoods}
              value={id}
              others={[...others, ...seq.filter( (_, i) => idx !== i )]}
              onChange={
                goodId => {
                  const newSqe = [...seq];
                  newSqe[idx] = goodId;
                  setFn(newSqe);
                }
              }
            />
        )
      }
    </Grid>;

  const Sect = ({ seq, others, setFn }: IItemListProps) =>
    <Grid container direction="column" spacing={1}>
      <ItemList seq={seq} others={others} setFn={setFn} />
      <Grid item>
        <Button variant="outlined" onClick={ () => setFn([...seq, getRandomGoodId()]) }>
          Add
        </Button>
        <Button variant="outlined" disabled={!seq.length} onClick={ () => setFn(seq.slice(0, -1)) }>
          Remove
        </Button>
      </Grid>
    </Grid>;

  return (
    <ThemeProvider theme={theme}>
      {
        transactions.length && fp.length
        ?
        <>
          <AppBar position="static">
            <Tabs value={currTab} onChange={ (_event, newValue) => setCurrTab(newValue) }>
              <Tab label="Calc" />
              <Tab label="Data" />
              <Tab label="FP" />
              <Tab label="Playground" />
              <Tab label="Presentation" />
            </Tabs>
          </AppBar>
          <Box m={3}>
            {
              currTab === 0 ?
                <Box border={1} m={1} p={1} borderColor={theme.palette.divider} borderRadius={4}>
                  <Grid container direction="row" spacing={1}>
                    <Grid item>
                      <Sect seq={antecedent} others={consequent} setFn={setAntecedent} />
                    </Grid>
                    <Grid item>
                      <Button>
                        {'>>>'}
                      </Button>
                    </Grid>
                    <Grid item>
                      <Sect seq={consequent} others={antecedent} setFn={setConsequent} />
                    </Grid>
                    <Grid item>
                      <TextField label="XC" value={stat.xc} variant="outlined" />
                    </Grid>
                    <Grid item>
                      <TextField label="Support" value={stat.c} variant="outlined" />
                    </Grid>
                    <Grid item>
                      <TextField label="Confidence" value={stat.confidence} variant="outlined" />
                    </Grid>
                    <Grid item>
                      <TextField label="Lift" value={stat.lift} variant="outlined" />
                    </Grid>
                    <Grid item>
                      <Button disabled={!antecedent.length || !consequent.length} onClick={ () => setStat(calcStat(antecedent, consequent)) }>
                        Calculate
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              : currTab === 1 ?
                <Grid container direction="column" spacing={2}>
                  <Grid container direction="row" spacing={2}>
                    <Grid item>
                      <TextField
                        label="Filter"
                        variant="outlined"
                        value={filter}
                        onChange={
                          event => {
                            const v = event.target.value.trim();
                            const trNum = parseInt(v);
                            if (isNaN(trNum) || (trNum >= 0 && trNum < transactions.length)) {
                              setFilter(v);
                            }
                          }
                        }
                        InputProps={{
                          style: {
                            minWidth: 340
                          },
                          endAdornment: <Button onClick={ () => setFilter('') }>Clear</Button>
                        }}
                      />
                    </Grid>
                    <Grid item>
                      <TextField label="Employees" value={employees.filter( v => typeof v === 'string' ).length} variant="outlined" />
                    </Grid>
                    <Grid item>
                      <TextField label="Goods" value={goods.length} variant="outlined" />
                    </Grid>
                    <Grid item>
                      <TextField label="Transactions" value={transactions.length} variant="outlined" />
                    </Grid>
                  </Grid>
                  <Grid item>
                    <Grid container direction="row" spacing={2}>
                      {list()}
                    </Grid>
                  </Grid>
                </Grid>
              : currTab === 2 ?
                <Grid container direction="column" spacing={2}>
                  <Grid container direction="row" spacing={2}>
                    <Grid item>
                      <TextField
                        label="Filter"
                        variant="outlined"
                        value={filterFP}
                        onChange={
                          event => {
                            const v = event.target.value.trim();
                            const cnt = parseInt(v);
                            if (isNaN(cnt) || (cnt >= 0 && cnt < 20)) {
                              setFilterFP(v);
                            }
                          }
                        }
                        InputProps={{
                          style: {
                            minWidth: 340
                          },
                          endAdornment: <Button onClick={ () => setFilterFP('') }>Clear</Button>
                        }}
                      />
                    </Grid>
                    <Grid item>
                      <TextField label="FP" value={fp.length} variant="outlined" />
                    </Grid>
                  </Grid>
                  <Grid item>
                    {listFP()}
                  </Grid>
                </Grid>
              : currTab === 3 ?
                <Grid container direction="row" spacing={4} justify="center">
                  <Grid item>
                    <Paper elevation={3}>
                      <Box p={2} minWidth={340}>
                        <Grid container direction="column" spacing={2}>
                          <Grid item>
                            <Typography gutterBottom variant="h5" component="h2">
                              Transaction
                            </Typography>
                          </Grid>
                          <Grid item>
                            <TextField
                              variant="outlined"
                              value={playground?.trNum}
                              onChange={
                                event => {
                                  const trNum = parseInt(event.target.value);
                                  if (trNum >= 0 && trNum < transactions.length) {
                                    setPlayground({
                                      trNum,
                                      selected: [],
                                      suggested: getSuggested3(trNum),
                                      moves: 0,
                                      method: 'FAST'
                                    })
                                  }
                                }
                              }
                              InputProps={{
                                style: {
                                  minWidth: 340
                                },
                                endAdornment:
                                  <>
                                    <Button
                                      onClick={
                                        () => {
                                          const trNum = Math.floor(Math.random() * transactions.length);
                                          setPlayground({
                                            trNum,
                                            selected: [],
                                            suggested: getSuggested3(trNum),
                                            moves: 0,
                                            method: 'FAST'
                                          });
                                        }
                                      }
                                    >
                                      Random
                                    </Button>
                                    <Button
                                      disabled={!playground}
                                      onClick={
                                        () => playground && setPlayground({
                                          ...playground,
                                          selected: [],
                                          suggested: [],
                                          moves: 0
                                        })
                                      }
                                    >
                                      Reset
                                    </Button>
                                  </>
                              }}
                            />
                          </Grid>
                          {
                            playground
                            &&
                            <Grid item>
                              <Transaction
                                trNum={playground.trNum}
                                selected={playground.selected}
                                suggested={playground.suggested}
                                hideNum
                                onClick={
                                  goodId => {
                                    if (!playground.selected.includes(goodId)) {
                                      const selected = [...playground.selected, goodId];
                                      const suggested = playground.suggested.filter( s => s.goodId !== goodId );
                                      setPlayground({ ...playground, selected, suggested, moves: playground.moves + 1 });
                                    }
                                  }
                                }
                              />
                            </Grid>
                          }
                        </Grid>
                      </Box>
                    </Paper>
                  </Grid>
                    <Grid item>
                      <Paper elevation={3}>
                        <Box p={2} minWidth={340}>
                          <Typography gutterBottom variant="h5" component="h2">
                            Suggestion
                          </Typography>
                          {
                            playground
                            ?
                              <Grid container direction="row" spacing={1}>
                                <Grid item>
                                  <Button
                                    variant="outlined"
                                    disabled={!playground.selected.length || done}
                                    onClick={ () => setPlayground({
                                      ...playground,
                                      suggested: playground.method === 'SLOW' ? getSuggested(playground.trNum, playground.selected) : getSuggested2(playground.selected)
                                    }) }
                                  >
                                    Get suggestion
                                  </Button>
                                </Grid>
                                <Grid item>
                                  <Button
                                    variant="outlined"
                                    disabled={!playground.selected.length || done}
                                    onClick={ () => setPlayground({
                                      ...playground,
                                      suggested: [],
                                      method: playground.method === 'SLOW' ? 'FAST' : 'SLOW'
                                    }) }
                                  >
                                    {`Method: ${playground.method}`}
                                  </Button>
                                </Grid>
                              </Grid>
                            :
                              undefined
                          }
                          {
                            (playground?.selected.length || playground?.suggested.length) && !done
                            ?
                              <>
                                <List>
                                {
                                  playground?.suggested.map(
                                    p =>
                                      <ListItem
                                        button
                                        onClick={
                                          () => {
                                            if (!playground.selected.includes(p.goodId) && transactions[playground.trNum].positions.includes(p.goodId)) {
                                              const selected = [...playground.selected, p.goodId];
                                              const suggested = playground.suggested.filter( s => s !== p );
                                              setPlayground({ ...playground, selected, suggested, moves: playground.moves + 0.25 });
                                            }
                                          }
                                        }
                                        style={
                                          transactions[playground.trNum].positions.includes(p.goodId) ? { backgroundColor: 'lime' } : undefined
                                        }
                                      >
                                        <ListItemText primary={goods[p.goodId]} secondary={p.stat.xc ? `xc: ${p.stat.xc}, supp: ${p.stat.c}, conf: ${p.stat.confidence.toFixed(6)}, lift: ${p.stat.lift.toFixed(6)}` : undefined} />
                                      </ListItem>
                                  )
                                }
                                </List>
                                {
                                  playground.suggested.length
                                  ?
                                    <Button
                                      variant="outlined"
                                      onClick={
                                        () => {
                                            const { moves, trNum } = playground;
                                            let selected = playground.selected;
                                            let suggested = playground.suggested;
                                            let i = 0;
                                            for (const { goodId } of playground.suggested) {
                                              if (!selected.includes(goodId) && transactions[trNum].positions.includes(goodId)) {
                                                selected = [...selected, goodId];
                                                suggested = suggested.filter( g => g.goodId !== goodId );
                                                i++;
                                              }
                                            }
                                            setPlayground({ ...playground, selected, suggested, moves: moves + 0.25 * i });
                                        }
                                      }
                                    >
                                      Use all
                                    </Button>
                                  :
                                    undefined
                                }
                              </>
                            :
                              undefined
                          }
                        </Box>
                      </Paper>
                    </Grid>
                  <Grid item>
                    <Paper elevation={3}>
                      <Box p={2} minWidth={340}>
                        <Typography gutterBottom variant="h5" component="h2">
                          Efficiency
                        </Typography>
                        {
                          playground
                          &&
                          <List>
                            <ListItem>
                              <ListItemText>{`Max selections: ${transactions[playground.trNum].positions.length}`}</ListItemText>
                            </ListItem>
                            <ListItem>
                              <ListItemText>{`Selections made: ${playground.moves}`}</ListItemText>
                            </ListItem>
                            {
                              transactions[playground.trNum].positions.length === playground.selected.length
                              ?
                                <ListItem>
                                  <ListItemText>{`Economy: ${Math.ceil((1 - playground.moves / transactions[playground.trNum].positions.length) * 100)}%`}</ListItemText>
                                </ListItem>
                              :
                                undefined
                            }
                          </List>
                        }
                        <Typography gutterBottom variant="h5" component="h2">
                          Settings
                        </Typography>
                        <Button variant="outlined" onClick={ () => setConsiderEmployee(!considerEmployee) }>
                          { considerEmployee ? 'Consider employee' : 'Don\'t suggest' }
                        </Button>
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>
              :
                <Link href="https://docs.google.com/presentation/d/1BNk2GmNjbufrxAUAoyiobdzUZtESY6yxzz3KIP0xwis/edit?usp=sharing">Presentation...</Link>
            }
          </Box>
        </>
      :
        <Typography>
          loading...
        </Typography>
      }
    </ThemeProvider>
  );
}

export default App;

  // const test = () => {
  //   const t = [
  //     [1],
  //     [2],
  //     [3],
  //     [1, 2, 3],
  //     [1, 2, 3, 4],
  //     [1, 2, 3, 4, 5],
  //     [1, 2, 4, 8, 9],
  //     [2, 3, 4, 5],
  //     [3, 4, 5],
  //     [4, 5],
  //     [5]
  //   ];

  //   const cmp = (a: number[], b: number[]) => {
  //     if (a.length !== b.length) {
  //       throw new Error(`uneven arrays ${a}-${b}`);
  //     }
  //     for (let i = 0; i < a.length; i++) {
  //       if (a[i] !== b[i]) {
  //         throw new Error('unequal arrays');
  //       }
  //     }
  //   };

  //   const data = [
  //     [[1], [2, 3, 4, 5, 8, 9]],
  //     [[1, 2], [3, 4, 5, 8, 9]],
  //     [[2, 3], [1, 4, 5]],
  //     [[2, 3, 4], [1, 5]],
  //     [[5], [1, 2, 3, 4]],
  //     [[4, 5], [1, 2, 3]],
  //     [[7], []],
  //     [[2, 3, 7], []],
  //     [[1, 4, 9], [2, 8]],
  //   ];

  //   for (const d of data) {
  //     cmp(_getSuggested2(d[0], t), d[1]);
  //   }

  //   console.log('test completed!');
  // };
  // test();

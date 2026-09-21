# Clase: la matemática del simulador, explicada desde cero

Este documento explica, paso a paso y con números concretos, cada fórmula que
usa el simulador. La idea es que lo puedas leer de corrido, sin tener que
saltar a otro lado a buscar qué significa una letra: **cada símbolo que
aparece se define inmediatamente después de la fórmula**, en una tablita, y
después se usa en un ejemplo numérico chiquito y redondo (no los números
reales y feos de una corrida de 1200 cuentas — números fáciles, para que
puedas seguir la cuenta con la calculadora del celular si querés).

Al final hay un **glosario general** con todos los símbolos juntos, para
repasar rápido antes de la presentación.

---

## Cómo está armado el simulador, en una frase

Se simulan precios de mercado primero (sin que nadie los pueda influir), y
**después** se simulan cuentas de inversión que deciden, día a día, si venden
cada cosa que tienen — la decisión de vender no es "si ganó, vender", sino una
**probabilidad** que depende de dos números que nosotros elegimos de
antemano (δ y κ). Al final del video, contamos qué pasó realmente y con eso
calculamos los mismos indicadores que usaría un economista con datos reales.

Siete piezas, en orden:

1. **Precios** — cómo se mueve el mercado
2. **Costos** — cuánto cuesta comprar y vender
3. **La regla de venta** — la pieza central: una probabilidad de vender, no un `if`
4. **Reinversión** — qué hace la cuenta con la plata después de vender
5. **Tres formas de medir el retorno** — con costos, sin comisión, sin nada
6. **PGR y PLR** — el número que mide el sesgo de disposición
7. **La regresión de sobreconfianza** — el número que mide si operar de más cuesta caro

---

## Antes de empezar: tres símbolos matemáticos que vas a ver todo el rato

No son parte del modelo financiero — son solo "operadores", como una suma o
una raíz cuadrada. Si ya los conocés, saltealos.

### `tanh` (tangente hiperbólica)

Es una función que agarra cualquier número (por más grande o chico que sea) y
lo "aplasta" para que quede siempre entre −1 y 1. Se usa acá para que una
ganancia gigante (+80%) no dispare la probabilidad de venta hasta el
infinito — el efecto se satura.

| x | tanh(x) |
|---|---|
| 0 | 0.00 |
| 0.5 | 0.46 |
| 1.0 | 0.76 |
| 1.25 | 0.85 |
| 2.0 | 0.96 |
| 5.0 | ≈1.00 |

Fijate: cuanto más grande el número, menos crece tanh — por eso decimos que
"se aplana". Y es una función **impar**: `tanh(−x) = −tanh(x)`. Esto importa
mucho más adelante, en la Sección 3.

### `clip(valor, mínimo, máximo)`

Simplemente no deja que un número se salga de un rango, como un volante con
tope. `clip(0.50, 0, 0.35) = 0.35` (se pasó, lo recorta). `clip(0.10, 0, 0.35)
= 0.10` (no se pasó, queda igual).

### Bernoulli(h)

Es "tirar una moneda cargada". Si `h = 0.05`, es una moneda que sale "sí" el
5% de las veces y "no" el 95% restante. La computadora saca un número
aleatorio entre 0 y 1; si ese número es menor que `h`, el resultado es "sí".

---

## Sección 1 — Precios: de dónde salen las ganancias y pérdidas

### La idea

Cada título (acción) no se mueve solo: se mueve un poco por lo que hace *todo*
el mercado, un poco por lo que hace *su sector*, y un poco por razones
propias de esa empresa. El simulador arma el retorno diario de cada título
sumando esas tres partes:

$$
r_{i,t} \;=\; \beta^{mkt}_i \cdot F^{mkt}_t \;+\; \beta^{sec}_i \cdot F^{sec(i)}_t \;+\; \varepsilon_{i,t}
$$

| Símbolo | Qué es | En nuestro ejemplo |
|---|---|---|
| $i$ | el número de identificación de un título (una acción) | Título "A" |
| $t$ | el día | día 1 |
| $r_{i,t}$ | el retorno (variación de precio, en %) del título $i$ en el día $t$ | lo que vamos a calcular |
| $F^{mkt}_t$ | el "humor" del mercado entero ese día (sube o baja todo junto) | $+1.0\%$ |
| $\beta^{mkt}_i$ | cuánto le pega el humor del mercado a *este* título en particular (si es 1, le pega normal; si es 2, le pega el doble) | $1.2$ |
| $F^{sec(i)}_t$ | el "humor" del sector al que pertenece el título $i$ ese día (ej: tecnología, energía) | $+0.5\%$ |
| $\beta^{sec}_i$ | cuánto le pega el humor del sector a este título | $0.8$ |
| $\varepsilon_{i,t}$ | ruido propio de la empresa ese día — noticias, rumores, nada que ver con el mercado ni el sector | $+0.2\%$ |

### El cálculo, con números

$$
r = (1.2 \times 1.0\%) + (0.8 \times 0.5\%) + 0.2\% = 1.20\% + 0.40\% + 0.20\% = 1.80\%
$$

Con ese retorno diario, el precio se actualiza así:

$$
P_{i,t} = P_{i,0} \cdot e^{\,r}
$$

| Símbolo | Qué es | En nuestro ejemplo |
|---|---|---|
| $P_{i,0}$ | precio del título el día que empezó a existir en la simulación | $\$100$ |
| $e$ | la constante de Euler ($\approx 2.71828$) — para un $r$ chico, $e^r \approx 1+r$, así que no hace falta una calculadora científica para tener la intuición | — |
| $P_{i,t}$ | precio del título ese día | lo calculamos abajo |

$$
P = 100 \times e^{0.018} = 100 \times 1.01816 \approx \$101.82
$$

**¿Por qué no un solo número aleatorio por título, sin factores?** Porque en
la vida real las acciones se mueven juntas (si cae el mercado, caen casi
todas un poco). Si cada título fuera 100% independiente, ninguna cartera
tendría riesgo real de mercado, y no tendríamos una manera honesta de medir
"exposición al riesgo" para la Sección 7.

**La regla de oro de todo el simulador:** este panel de precios se genera
*una sola vez, al principio*, antes de que exista una sola cuenta. Ninguna
cuenta puede cambiar un precio ni verlo antes de tiempo. Por eso es
matemáticamente imposible que el simulador invente "trading informado" por
accidente — la Sección 7 depende totalmente de esta garantía.

---

## Sección 2 — Cuánto cuesta comprar y vender

### La idea

Nadie compra y vende al mismo precio. Hay un precio de "venta" (bid, más
bajo) y un precio de "compra" (ask, más alto) alrededor del precio medio, y
además el bróker cobra una comisión.

$$
P^{ask}_{i,t} = P_{i,t}\left(1+\frac{s_i}{2}\right), \qquad P^{bid}_{i,t} = P_{i,t}\left(1-\frac{s_i}{2}\right)
$$

| Símbolo | Qué es | En nuestro ejemplo |
|---|---|---|
| $P_{i,t}$ | precio medio del título (el de la Sección 1) | $\$100$ |
| $s_i$ | el spread total de ese título, en % del precio (varía por título, entre 0.10% y 0.70% en el simulador) | $2\%$ (número grande a propósito, para que la cuenta sea fácil) |
| $P^{ask}_{i,t}$ | precio al que **comprás** | lo calculamos |
| $P^{bid}_{i,t}$ | precio al que **vendés** | lo calculamos |

$$
P^{ask} = 100\times(1+0.01) = \$101, \qquad P^{bid} = 100\times(1-0.01) = \$99
$$

Y en cada operación (comprar o vender) se paga una comisión:

$$
\text{comisión} = \max\big(\$2.00,\; 0.04\% \times \text{valor de la operación}\big)
$$

Si comprás 100 acciones a \$101 (valor de la operación = \$10,100):
$0.04\% \times \$10{,}100 = \$4.04$, que es más que el mínimo de \$2, así que
la comisión es **\$4.04**.

---

## Sección 3 — La regla de venta: la pieza más importante de todo el trabajo

### La idea, antes de la fórmula

Esta es la sección que hay que entender mejor, porque es donde se "esconden"
los dos sesgos que queremos medir. **Ni δ ni κ deciden directamente si algo
se vende.** Lo que hacen es subir o bajar una *probabilidad* de venta que se
vuelve a calcular todos los días, para cada posición. Nada en el código dice
literalmente "si ganó, vender" — eso sería trampa, porque estaríamos
fabricando el resultado que después queremos "descubrir".

Primero necesitamos saber si la posición está ganando o perdiendo:

$$
x = \frac{P_{mid}(t) - P_{compra}}{P_{compra}}
$$

| Símbolo | Qué es | En nuestro ejemplo (caso ganancia) |
|---|---|---|
| $P_{mid}(t)$ | precio medio del título hoy | $\$110$ |
| $P_{compra}$ | precio al que esta cuenta compró esta posición (el ask que pagó, no el precio medio) | $\$100$ |
| $x$ | el retorno **no realizado** — "de papel" — de esta posición | lo calculamos |

$$
x = \frac{110-100}{100} = 0.10 = +10\%
$$

Ahora sí, la fórmula completa de la probabilidad de venta hoy:

$$
h = \text{clip}\Big(\underbrace{\lambda_0}_{\text{base}} \times \underbrace{\text{churn}}_{\text{parejo}} \times \underbrace{\text{sesgo}}_{\text{asimétrico}},\;\; 0,\;\; h_{max}\Big)
$$

$$
\text{churn} = 1 + 6\,\kappa_i \qquad\qquad \text{sesgo} = 1 + 0.9\,\delta_i \cdot \tanh\!\Big(\frac{x}{0.08}\Big)
$$

| Símbolo | Qué es | Valor en nuestro ejemplo |
|---|---|---|
| $\lambda_0$ | probabilidad "base" de vender un día cualquiera, si no hubiera ningún sesgo ni sobreconfianza — pura rotación de fondo | $0.003$ (0.3%) |
| $\kappa_i$ (kappa) | **sobreconfianza / intensidad de trading** de la cuenta $i$. Va de 0 (nunca sobre-opera) a 1 (opera muchísimo). Es uno de los dos números que nosotros "inyectamos" a propósito | $0.5$ |
| $\text{churn}$ | multiplicador de la probabilidad de venta que sube con $\kappa$ — pero **igual** para ganancias que para pérdidas. Es el dial de "cuánto opero", no de "qué vendo primero" | $1+6\times0.5=4.0$ |
| $\delta_i$ (delta) | **fuerza de la disposición** de la cuenta $i$. Va de 0 (nunca retiene perdedores de más) a 1 (los retiene mucho). Es el segundo número que inyectamos | $0.5$ |
| $x$ | el retorno de papel de esta posición (calculado arriba) | $+10\%$ |
| $0.08$ | la escala a la que la función tanh empieza a "aplanarse" — con retornos alrededor de 8% el efecto ya es fuerte | fijo, constante del modelo |
| $\text{sesgo}$ | multiplicador que sube la probabilidad si $x>0$ (ganancia) y la baja si $x<0$ (pérdida). Con $\delta=0$ este número da exactamente 1, sin importar cuánto ganó o perdió la posición | lo calculamos |
| $h_{max}$ | techo de seguridad: nunca más de 35% de probabilidad de vender una posición en un solo día | $0.35$ |
| $h$ | la probabilidad final de vender esta posición hoy | lo calculamos |

### El cálculo, caso por caso

**Caso 1 — la posición está ganando 10%:**

$$
\text{sesgo} = 1 + 0.9\times0.5\times\tanh(0.10/0.08) = 1+0.45\times\tanh(1.25) = 1+0.45\times0.848 = 1.382
$$

$$
h = \text{clip}(0.003\times4.0\times1.382,\; 0,\; 0.35) = \text{clip}(0.01658,\dots) = 0.01658 \;\;\to\;\; \mathbf{1.66\%}
$$

**Caso 2 — la misma cuenta, la misma posición, pero perdiendo 10% en vez de ganar (solo cambia el signo de $x$):**

$$
\text{sesgo} = 1+0.9\times0.5\times\tanh(-0.10/0.08) = 1-0.45\times0.848 = 0.618
$$

$$
h = \text{clip}(0.003\times4.0\times0.618,\;0,\;0.35) = 0.00742 \;\;\to\;\; \mathbf{0.74\%}
$$

**¿Qué acabamos de mostrar?** Con exactamente la misma cuenta ($\delta=0.5$,
$\kappa=0.5$) y el mismo tamaño de movimiento (10%), la probabilidad de
vender un ganador (1.66%) es **2.24 veces** la probabilidad de vender un
perdedor (0.74%). Nadie escribió esa asimetría a mano — salió sola de una
fórmula donde $\delta$ solo entra multiplicado por $\tanh(x)$, una función
impar. Si $\delta$ fuera 0, sesgo daría 1 en los dos casos y esa asimetría
desaparecería del todo.

Con esa probabilidad, la computadora tira la moneda cargada de la que
hablamos al principio: **Bernoulli(h)**. Si el número aleatorio que sale es
menor a 0.0166, la posición se vende hoy. Si no, sigue en cartera y mañana se
vuelve a tirar la moneda (con un $x$ probablemente distinto, porque el precio
se sigue moviendo).

---

## Sección 4 — Qué hace la cuenta con la plata después de vender

Cuando se cierra una posición, la plata queda 2 días sin invertir (fricción
de "estar en efectivo") y después se compra un título elegido totalmente al
azar entre todos los disponibles — **nunca** en función de qué va a rendir
ese título después. Esto es la misma garantía de la Sección 1, aplicada del
lado de las cuentas.

El tamaño de la nueva posición es:

$$
\text{monto objetivo} = \frac{\text{valor total actual de la cuenta}}{n_i}
$$

| Símbolo | Qué es | En nuestro ejemplo |
|---|---|---|
| $n_i$ | número de posiciones que la cuenta $i$ mantiene siempre (entre 5 y 30, elegido al azar por cuenta) | $5$ |
| valor total actual | efectivo + valor de mercado de todo lo que tiene invertido, hoy | $\$50{,}000$ |

$$
\text{monto objetivo} = \frac{\$50{,}000}{5} = \$10{,}000 \text{ por posición}
$$

---

## Sección 5 — Tres formas distintas de medir "cuánto ganó" una cuenta

### La idea

Si sólo miráramos el retorno "de verdad" (con comisión y con spread
incluidos), nunca podríamos separar "esta cuenta perdió plata porque operó
de más y eso es caro" de "esta cuenta perdió plata porque eligió mal qué
comprar". Por eso se calculan tres versiones del mismo retorno.

**Ejemplo:** compramos 100 acciones a un precio ask de \$101 y las vendemos
después a un precio bid de \$109, pagando \$4 de comisión en cada operación.
Mientras tanto, el precio *medio* (sin spread) pasó de \$100 a \$108.

$$
R^{neto} = \frac{\text{plata que quedó} - \text{plata que se puso}}{\text{plata que se puso}}
$$

| Símbolo | Qué es | Valor |
|---|---|---|
| plata que se puso | $100\text{ acciones}\times\$101 + \$4\text{ comisión} = \$10{,}104$ | $\$10{,}104$ |
| plata que quedó | $100\text{ acciones}\times\$109 - \$4\text{ comisión} = \$10{,}896$ | $\$10{,}896$ |
| $R^{neto}$ | retorno real, con TODOS los costos adentro | $(10{,}896-10{,}104)/10{,}104 = \mathbf{7.84\%}$ |

$$
R^{bruto,fill} = R^{neto} + \frac{\text{comisión total pagada}}{\text{plata que se puso}}
$$

$$
R^{bruto,fill} = 7.84\% + \frac{\$8}{\$10{,}104} = 7.84\%+0.08\% = \mathbf{7.92\%}
$$

Este número le devuelve la comisión, pero **todavía tiene adentro medio
spread de cada lado** (compramos 1% más caro que el precio medio, vendimos 1%
más barato) — por eso no es un verdadero "sin fricciones".

$$
R^{bruto,mid} = \frac{\text{las mismas acciones, revaluadas al precio medio, sin comisión}}{\text{plata que se puso, sin comisión ni sobreprecio}}
$$

Usando el precio medio de compra (\$100) y de venta (\$108), sobre un monto
redondo de \$10,000 sin comisión:

$$
R^{bruto,mid} = \frac{100\text{ acciones}\times(\$108-\$100)}{\$10{,}000} = \frac{\$800}{\$10{,}000} = \mathbf{8.00\%}
$$

**El orden nunca es casualidad:** $R^{bruto,mid}(8.00\%) > R^{bruto,fill}(7.92\%) > R^{neto}(7.84\%)$.
Cada medida le devuelve un costo distinto a la anterior. La brecha entre las
dos últimas (8.00% − 7.92% = 0.08 puntos) es *puramente* el spread; no tiene
nada que ver con ningún sesgo de comportamiento.

---

## Sección 6 — PGR y PLR: el número que mide la disposición

### La idea

Cada día en que una cuenta vendió *algo*, se mira **toda** su cartera de ese
día y se cuenta: de las posiciones que estaban ganando, ¿cuántas se vendieron
y cuántas se quedaron? Lo mismo para las que estaban perdiendo.

| Símbolo | Qué es |
|---|---|
| $G_r$ | ganancias realizadas — posiciones en ganancia que SÍ se vendieron ese día |
| $G_p$ | ganancias de papel — posiciones en ganancia que NO se vendieron ese día |
| $L_r$ | pérdidas realizadas — posiciones en pérdida que SÍ se vendieron |
| $L_p$ | pérdidas de papel — posiciones en pérdida que NO se vendieron |

$$
\widehat{PGR} = \frac{G_r}{G_r+G_p}, \qquad \widehat{PLR} = \frac{L_r}{L_r+L_p}
$$

**Ejemplo con números chicos** (sumando muchos días y muchas cuentas):
$G_r=30$, $G_p=120$, $L_r=10$, $L_p=90$.

$$
\widehat{PGR} = \frac{30}{30+120} = \frac{30}{150} = 20\%
$$

$$
\widehat{PLR} = \frac{10}{10+90} = \frac{10}{100} = 10\%
$$

$\widehat{PGR}-\widehat{PLR} = 10$ puntos porcentuales. $\widehat{PGR}/\widehat{PLR}=2$: de cada 10
ganadores que había disponibles para vender, se vendieron 2; de cada 10
perdedores disponibles, se vendió 1. **Esta es la definición operacional del
efecto disposición**, y no depende de ningún supuesto raro — es aritmética
directa sobre lo que efectivamente pasó.

---

## Sección 7 — La regresión de sobreconfianza

### La idea

Queremos saber si las cuentas que operan mucho (turnover alto) terminan con
peor retorno. Se hace una regresión lineal, una fila por cuenta:

$$
r_i = \alpha + \beta \cdot \text{Turnover}_i + \gamma' X_i + \epsilon_i
$$

| Símbolo | Qué es |
|---|---|
| $r_i$ | el retorno de la cuenta $i$ (se corre tres veces: con $R^{neto}$, $R^{bruto,fill}$ y $R^{bruto,mid}$) |
| $\text{Turnover}_i$ | cuánto operó la cuenta $i$, anualizado (1.0 = movió el equivalente a toda su cartera una vez en el año) |
| $X_i$ | los controles: tamaño de la cartera ($\log$ del capital promedio), número de posiciones, y exposición al riesgo de mercado |
| $\alpha$ | el retorno esperado de una cuenta con turnover y controles en cero (la ordenada al origen) |
| $\beta$ | **el número que nos interesa**: cuánto cambia el retorno por cada unidad extra de turnover, dejando todo lo demás fijo |
| $\gamma$ | el efecto de cada variable de control (uno por cada columna de $X_i$) |
| $\epsilon_i$ | el residuo — todo lo que le pasó a esa cuenta en particular y que el modelo no explica |

**La prueba entera se reduce a esto:** si $\beta<0$ sólo en el retorno
**neto** pero es $\approx 0$ en el **bruto,mid**, operar de más es caro pero no
está mal informado. Si $\beta$ también es negativo en el bruto,mid, hay algo
más específico pasando (ver la página de "Diagnóstico de confusores" en la
aplicación).

### Un ejemplo de predicción, con coeficientes ya estimados

Supongamos que la regresión ya corrió y encontró estos coeficientes (números
inventados, redondos, solo para practicar la cuenta):
$\alpha=-0.020$, $\beta=-0.050$, $\gamma_{aum}=0.010$, $\gamma_{pos}=-0.001$,
$\gamma_{riesgo}=0.020$.

Y una cuenta con: turnover $=1.5$, $\log(\text{AUM})=11.5$, $n_i=15$
posiciones, exposición al riesgo $=1.1$.

$$
\hat{r}_i = -0.020 + (-0.050)(1.5) + (0.010)(11.5) + (-0.001)(15) + (0.020)(1.1)
$$

$$
\hat{r}_i = -0.020 -0.075+0.115-0.015+0.022 = \mathbf{0.027} \;\;(2.7\%)
$$

Si esa cuenta en realidad tuvo un retorno de $-1.0\%$, el residuo es
$-1.0\%-2.7\% = -3.7$ puntos: todo lo que ni el turnover ni los controles
lograron explicar de esa cuenta particular.

---

## Glosario general (para repasar rápido)

| Símbolo | Significado |
|---|---|
| $i$ | índice de un título (Secciones 1–2) o de una cuenta (Secciones 3–7) |
| $t$ | día de mercado |
| $k$ | índice de una posición dentro de la cartera de una cuenta |
| $r_{i,t}$ | retorno logarítmico diario del título $i$ el día $t$ |
| $F^{mkt}_t$, $F^{sec}_t$ | factor de mercado y de sector ese día |
| $\beta^{mkt}_i$, $\beta^{sec}_i$ | qué tanto le pega a este título el mercado / su sector |
| $\varepsilon_{i,t}$ | ruido propio del título, ese día |
| $P_{i,t}$ | precio medio de un título |
| $s_i$ | spread total de un título, en % |
| $P^{ask}$, $P^{bid}$ | precio de compra y de venta |
| $\delta_i$ | fuerza del efecto disposición de la cuenta $i$ (inyectado, 0 a 1) |
| $\kappa_i$ | intensidad de sobreconfianza/rotación de la cuenta $i$ (inyectado, 0 a 1) |
| $x$ | retorno no realizado ("de papel") de una posición |
| $\lambda_0$ | probabilidad base diaria de vender, sin ningún sesgo |
| $\text{churn}$ | multiplicador de $\kappa$ sobre la probabilidad de venta (parejo, no distingue ganancia/pérdida) |
| $\text{sesgo}$ | multiplicador de $\delta$ sobre la probabilidad de venta (asimétrico: >1 en ganancia, <1 en pérdida) |
| $h$ | probabilidad final de vender una posición hoy |
| $h_{max}$ | techo de esa probabilidad |
| $W_i$ | capital inicial de la cuenta $i$ |
| $n_i$ | número de posiciones que mantiene la cuenta $i$ |
| $R^{neto}$ | retorno real de una cuenta, con todos los costos |
| $R^{bruto,fill}$ | retorno sin comisión, pero todavía con medio spread adentro |
| $R^{bruto,mid}$ | retorno sin ningún costo — el contrafactual sin fricciones |
| $G_r, G_p$ | ganancias realizadas / de papel |
| $L_r, L_p$ | pérdidas realizadas / de papel |
| $\widehat{PGR}$, $\widehat{PLR}$ | proporción de ganancias / pérdidas que se realizaron |
| $r_i$ | retorno de la cuenta $i$ (variable dependiente de la regresión) |
| $\text{Turnover}_i$ | qué tanto operó la cuenta $i$, anualizado |
| $X_i$ | controles de la regresión: tamaño, n° de posiciones, exposición al riesgo |
| $\alpha, \beta, \gamma$ | coeficientes estimados de la regresión |
| $\epsilon_i$ | residuo de la cuenta $i$ |

---

## Chuleta de una página

1. **Precios:** se generan solos, antes que las cuentas, para que sea
   imposible que una cuenta "sepa" el futuro.
2. **Vender no es un `if`**: es una probabilidad $h$ que sube con $\kappa$
   *igual* para ganancias y pérdidas, y sube con $\delta$ *solo* para
   ganancias (y baja para pérdidas), a través de $\tanh(x)$.
3. **Tres retornos, no uno**: neto (todo adentro) < bruto-fill (sin
   comisión) < bruto-mid (sin nada) — la diferencia entre cada par te dice
   exactamente qué costo estás mirando.
4. **PGR y PLR son una división**, hecha sobre conteos de lo que
   efectivamente pasó — nunca un parámetro que se fija a mano.
5. **La regresión** compara el mismo turnover contra tres retornos
   distintos; si el efecto solo aparece en el neto, es costo; si aparece
   también en el bruto-mid, es algo más.

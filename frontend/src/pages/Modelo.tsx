import { Eq, EqInline } from "../components/Eq";
import { Panel } from "../components/ui";

export function Modelo() {
  return (
    <div>
      <h1>El modelo</h1>
      <p className="prose" style={{ color: "var(--ink-soft)" }}>
        Todo lo que sigue son las reglas exactas que corre el simulador. Nada de esto
        es una caja negra: cada número que se reporta más adelante sale de estas
        ecuaciones.
      </p>

      <h2 style={{ marginTop: "2.2rem" }}>1. Precios: un modelo de factores</h2>
      <div className="prose">
        <p>
          Cada uno de los <EqInline>{"N \\geq 50"}</EqInline> títulos tiene un retorno
          logarítmico diario armado con tres piezas: un factor de mercado que comparten
          todos, un factor de sector que comparten los títulos del mismo sector, y un
          componente idiosincrático propio de cada título.
        </p>
        <Eq>{"r_{i,t} \\;=\\; \\beta^{mkt}_i \\, F^{mkt}_t \\;+\\; \\beta^{sec}_i \\, F^{sec(i)}_t \\;+\\; \\varepsilon_{i,t}"}</Eq>
        <p>
          con <EqInline>{"F^{mkt}_t \\sim \\mathcal{N}(\\mu_{mkt}, \\sigma_{mkt}^2)"}</EqInline>,{" "}
          <EqInline>{"F^{sec}_t \\sim \\mathcal{N}(\\mu_{sec}, \\sigma_{sec}^2)"}</EqInline> y{" "}
          <EqInline>{"\\varepsilon_{i,t} \\sim \\mathcal{N}(0, \\sigma_i^2)"}</EqInline>, todos
          independientes entre sí y a través del tiempo. El precio es la exponencial
          acumulada: <EqInline>{"P_{i,t} = P_{i,0}\\exp\\!\\big(\\sum_{s\\le t} r_{i,s}\\big)"}</EqInline>.
        </p>
        <p>
          <strong>¿Por qué un modelo de factores y no un GBM plano por título?</strong>{" "}
          Con GBM independiente por título, dos cuentas cualesquiera tendrían carteras
          sin ninguna correlación entre sí, lo cual no es realista, y —más importante
          para este trabajo— no daría ninguna medida honesta de{" "}
          <em>exposición al riesgo</em>. Con un beta de mercado por título, cada cuenta
          tiene una exposición al mercado bien definida, que es exactamente uno de los
          controles que pide la regresión de sobreconfianza (<span className="mono">X<sub>i</sub></span>).
        </p>
        <p>
          <strong>La restricción grande.</strong> Todo el panel de precios —los{" "}
          <EqInline>{"N \\times T"}</EqInline> retornos, para los 500+ días completos— se
          genera una sola vez, al comienzo, antes de que exista un solo agente. Ningún
          agente puede escribir sobre este arreglo ni influirlo (no hay impacto de
          mercado). Por construcción, ninguna decisión de compra puede estar
          correlacionada con lo que ese título vaya a rendir después, porque el
          retorno futuro ya estaba fijado antes de que la decisión existiera.
        </p>
      </div>

      <h2 style={{ marginTop: "2.2rem" }}>2. Costos de transacción</h2>
      <div className="prose">
        <p>
          Cada título cotiza con un precio bid y un precio ask alrededor del precio
          medio (<em>mid</em>), con un spread total en puntos básicos que varía por
          título entre 10 y 70 bps:
        </p>
        <Eq>{"P^{ask}_{i,t} = P_{i,t}\\Big(1+\\tfrac{s_i}{2}\\Big), \\qquad P^{bid}_{i,t} = P_{i,t}\\Big(1-\\tfrac{s_i}{2}\\Big)"}</Eq>
        <p>
          Toda compra ocurre al ask y toda venta al bid. Además, cada operación paga
          una comisión proporcional con un piso mínimo:
        </p>
        <Eq>{"\\text{comisión} = \\max\\big(\\$2.00,\\; 4\\text{bps} \\times \\text{valor de la operación}\\big)"}</Eq>
      </div>

      <h2 style={{ marginTop: "2.2rem" }}>3. La regla de venta: una tasa de riesgo, no un if</h2>
      <div className="prose">
        <p>
          Este es el punto que exige más cuidado: <EqInline>\delta</EqInline> y{" "}
          <EqInline>\kappa</EqInline> no determinan directamente si algo se vende. Cada
          posición abierta tiene, cada día, una probabilidad instantánea de cierre
          (una <em>tasa de riesgo</em> u <em>hazard</em>). El retorno no realizado de
          la posición es:
        </p>
        <Eq>{"x_{i,k,t} = \\frac{P_{mid}(t) - P_{compra}}{P_{compra}}"}</Eq>
        <p>y la tasa de riesgo diaria es el producto de tres piezas — una base, un multiplicador de churn y un multiplicador de sesgo — recortado a [0, 0.35]:</p>
        <Eq>{"h_{i,k,t} = \\text{clip}\\big(\\lambda_0 \\cdot \\text{churn}_i \\cdot \\text{sesgo}_{i,t},\\;\\, 0,\\, 0.35\\big)"}</Eq>
        <Eq>{"\\text{churn}_i = 1 + 6\\,\\kappa_i \\qquad\\qquad \\text{sesgo}_{i,t} = 1 + 0.9\\,\\delta_i \\tanh\\!\\big(x_{i,k,t}/0.08\\big)"}</Eq>
        <p>
          y la venta ocurre con <EqInline>{"\\text{Bernoulli}(h_{i,k,t})"}</EqInline>, un
          sorteo independiente por posición y por día.
        </p>
        <p>
          Noten la asimetría de roles: <EqInline>{"\\text{churn}_i"}</EqInline> multiplica
          la tasa de riesgo <em>igual</em> para ganancias y pérdidas —es un dial puro de
          frecuencia de trading, no distingue signo—, mientras que{" "}
          <EqInline>{"\\text{sesgo}_{i,t}"}</EqInline> sólo entra a través de una función
          impar de <EqInline>x</EqInline>: para <EqInline>{"x>0"}</EqInline> multiplica por
          más de 1 (vende más rápido a los ganadores), para <EqInline>{"x<0"}</EqInline>{" "}
          por menos de 1 (retiene más a los perdedores). Con{" "}
          <EqInline>{"\\delta=0"}</EqInline> el término vale exactamente 1 para
          cualquier <EqInline>x</EqInline>, así que ganancias y pérdidas se venden a la
          misma tasa y no hay ningún sesgo mecánico incorporado. <strong>PGR y PLR no
          se fijan en ningún lado del código</strong> — son un conteo, hecho después,
          de lo que efectivamente se vendió.
        </p>
      </div>

      <h2 style={{ marginTop: "2.2rem" }}>4. Reinversión</h2>
      <div className="prose">
        <p>
          Cuando una posición se cierra, el efectivo queda inmóvil dos días (fricción
          estructural de "cash drag", siempre activa) y luego se redespliega en un
          título elegido con <EqInline>{"\\text{Uniforme}\\{1,\\dots,N\\}"}</EqInline>,{" "}
          <strong>nunca</strong> en función de ninguna proyección de retorno. El tamaño
          del nuevo lote es el valor total actual de la cuenta dividido entre su número
          objetivo de posiciones —no un monto fijo del capital inicial, precisamente
          para que las ganancias de un lote sigan componiendo en vez de quedar
          atrapadas en efectivo cada vez que se cierra un ganador grande.
        </p>
      </div>

      <h2 style={{ marginTop: "2.2rem" }}>5. Tres medidas de retorno por cuenta</h2>
      <div className="prose">
        <p>
          La comparación entera de la sección de sobreconfianza depende de separar el
          retorno realmente cobrado del retorno que se habría obtenido sin fricciones:
        </p>
        <Eq>{"R^{neto}_i = \\frac{V^{final}_i - W_i}{W_i}, \\qquad V^{final}_i = \\text{efectivo} + \\sum_k \\text{acciones}_k \\cdot P^{bid}_k"}</Eq>
        <Eq>{"R^{bruto,fill}_i = R^{neto}_i + \\frac{\\text{comisión total pagada}_i}{W_i}"}</Eq>
        <Eq>{"R^{bruto,mid}_i = \\frac{1}{W_i}\\sum_{\\text{lotes } k} \\text{acciones}^{mid}_k \\cdot \\big(P^{mid}_{k,\\text{cierre}} - P^{mid}_{k,\\text{compra}}\\big)"}</Eq>
        <p>
          <span className="mono">bruto,fill</span> quita la comisión pero deja fijo el
          spread dentro de los precios de ejecución —es exactamente la medida que un
          análisis descuidado llamaría "bruta" sin serlo del todo. <span className="mono">bruto,mid</span>{" "}
          repite las mismas decisiones (qué título, cuándo, cuánto dinero) pero valora
          cada entrada y salida al precio medio y sin comisión: es el verdadero
          contrafactual sin fricciones de esas mismas decisiones.
        </p>
      </div>

      <Panel title="Por qué esto importa para el diagnóstico" sub="">
        <p className="prose" style={{ marginBottom: 0 }}>
          Si <EqInline>{"\\beta"}</EqInline> es negativo en <span className="mono">neto</span> pero{" "}
          ≈0 en <span className="mono">bruto,mid</span>, el trading es caro pero no
          está mal informado (Barber &amp; Odean 2000). Si <EqInline>{"\\beta"}</EqInline>{" "}
          también es negativo en <span className="mono">bruto,mid</span>, algo más
          específico está pasando — ver{" "}
          <span className="mono">Diagnóstico de confusores</span>.
        </p>
      </Panel>

      <h2 style={{ marginTop: "2.2rem" }}>6. Estimador de disposición</h2>
      <div className="prose">
        <p>
          En cada día en que una cuenta vende algo, se clasifica cada posición que
          tenía abierta ese día como ganancia o pérdida de papel frente a su precio de
          compra:
        </p>
        <Eq>{"\\widehat{PGR} = \\frac{G_r}{G_r+G_p}, \\qquad \\widehat{PLR} = \\frac{L_r}{L_r+L_p}"}</Eq>
        <p>
          Los días en que la cuenta no vendió nada no aportan ningún conteo. El
          bootstrap para el error estándar remuestrea <strong>cuentas completas</strong>,
          no operaciones individuales (ver Validación, donde se muestra cuánto se
          subestima el error si esto se hace mal).
        </p>
      </div>

      <h2 style={{ marginTop: "2.2rem" }}>7. Estimador de sobreconfianza</h2>
      <div className="prose">
        <p>Para cada cuenta i, con una sola observación por cuenta:</p>
        <Eq>{"r_i = \\alpha + \\beta \\cdot \\text{Turnover}_i + \\gamma' X_i + \\epsilon_i"}</Eq>
        <p>
          con <EqInline>{"X_i = [\\log(\\text{AUM}_i),\\; n_i,\\; \\text{exposición de riesgo}_i]"}</EqInline>,
          estimado por MCO con errores estándar robustos a heterocedasticidad (HC1),
          corrido tres veces: una por cada definición de retorno de la sección 5.
        </p>
      </div>
    </div>
  );
}

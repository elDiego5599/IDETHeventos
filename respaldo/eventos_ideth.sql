--
-- PostgreSQL database dump
--

\restrict pa25ZEJX2HIYNbpj2UOr7B4gg0NkBrZq0ihqWcZekUE6CbyEtm1m8WMYggBZg8O

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: calificaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calificaciones (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    evento_id integer NOT NULL,
    puntuacion smallint NOT NULL,
    CONSTRAINT calificaciones_puntuacion_check CHECK (((puntuacion >= 1) AND (puntuacion <= 5)))
);


--
-- Name: calificaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.calificaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calificaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.calificaciones_id_seq OWNED BY public.calificaciones.id;


--
-- Name: categorias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL
);


--
-- Name: categorias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categorias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categorias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categorias_id_seq OWNED BY public.categorias.id;


--
-- Name: comentarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comentarios (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    evento_id integer NOT NULL,
    texto text NOT NULL,
    fecha timestamp without time zone NOT NULL
);


--
-- Name: comentarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.comentarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: comentarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.comentarios_id_seq OWNED BY public.comentarios.id;


--
-- Name: encuestas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encuestas (
    id integer NOT NULL,
    evento_id integer NOT NULL,
    titulo character varying(150) NOT NULL,
    pregunta_1 character varying(255) NOT NULL,
    opciones_1 text NOT NULL,
    pregunta_2 character varying(255),
    opciones_2 text,
    pregunta_abierta character varying(255) NOT NULL,
    activa boolean DEFAULT true,
    fecha_creacion timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: encuestas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.encuestas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: encuestas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.encuestas_id_seq OWNED BY public.encuestas.id;


--
-- Name: eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eventos (
    id integer NOT NULL,
    titulo character varying(150) NOT NULL,
    descripcion text,
    fecha timestamp without time zone NOT NULL,
    ubicacion_id integer,
    categoria_id integer,
    organizador_id integer,
    imagen_url text,
    frase_motivacional character varying(255),
    permite_voluntarios boolean DEFAULT false,
    resumen_pasado text
);


--
-- Name: eventos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.eventos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: eventos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.eventos_id_seq OWNED BY public.eventos.id;


--
-- Name: inscripciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inscripciones (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    evento_id integer NOT NULL,
    fecha_registro timestamp without time zone NOT NULL,
    tipo_participacion character varying(50) DEFAULT 'asistente'::character varying,
    detalle_participacion text
);


--
-- Name: inscripciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inscripciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inscripciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inscripciones_id_seq OWNED BY public.inscripciones.id;


--
-- Name: organizadores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizadores (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL
);


--
-- Name: organizadores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organizadores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organizadores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organizadores_id_seq OWNED BY public.organizadores.id;


--
-- Name: reportes_problemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reportes_problemas (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    evento_id integer,
    tipo_problema character varying(100) NOT NULL,
    descripcion text NOT NULL,
    estado character varying(30) DEFAULT 'pendiente'::character varying NOT NULL,
    fecha timestamp without time zone NOT NULL
);


--
-- Name: reportes_problemas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reportes_problemas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reportes_problemas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reportes_problemas_id_seq OWNED BY public.reportes_problemas.id;


--
-- Name: respuestas_encuestas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.respuestas_encuestas (
    id integer NOT NULL,
    encuesta_id integer NOT NULL,
    usuario_id integer NOT NULL,
    respuesta_1 character varying(100) NOT NULL,
    respuesta_2 character varying(100),
    respuesta_abierta text,
    fecha timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: respuestas_encuestas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.respuestas_encuestas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: respuestas_encuestas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.respuestas_encuestas_id_seq OWNED BY public.respuestas_encuestas.id;


--
-- Name: sugerencias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sugerencias (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    texto text NOT NULL,
    fecha timestamp without time zone NOT NULL
);


--
-- Name: sugerencias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sugerencias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sugerencias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sugerencias_id_seq OWNED BY public.sugerencias.id;


--
-- Name: ubicaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ubicaciones (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL
);


--
-- Name: ubicaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ubicaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ubicaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ubicaciones_id_seq OWNED BY public.ubicaciones.id;


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash text NOT NULL,
    rol character varying(20) DEFAULT 'estudiante'::character varying NOT NULL,
    CONSTRAINT usuarios_rol_check CHECK (((rol)::text = ANY ((ARRAY['admin'::character varying, 'estudiante'::character varying])::text[])))
);


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: calificaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificaciones ALTER COLUMN id SET DEFAULT nextval('public.calificaciones_id_seq'::regclass);


--
-- Name: categorias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias ALTER COLUMN id SET DEFAULT nextval('public.categorias_id_seq'::regclass);


--
-- Name: comentarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios ALTER COLUMN id SET DEFAULT nextval('public.comentarios_id_seq'::regclass);


--
-- Name: encuestas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuestas ALTER COLUMN id SET DEFAULT nextval('public.encuestas_id_seq'::regclass);


--
-- Name: eventos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos ALTER COLUMN id SET DEFAULT nextval('public.eventos_id_seq'::regclass);


--
-- Name: inscripciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripciones ALTER COLUMN id SET DEFAULT nextval('public.inscripciones_id_seq'::regclass);


--
-- Name: organizadores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizadores ALTER COLUMN id SET DEFAULT nextval('public.organizadores_id_seq'::regclass);


--
-- Name: reportes_problemas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes_problemas ALTER COLUMN id SET DEFAULT nextval('public.reportes_problemas_id_seq'::regclass);


--
-- Name: respuestas_encuestas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas_encuestas ALTER COLUMN id SET DEFAULT nextval('public.respuestas_encuestas_id_seq'::regclass);


--
-- Name: sugerencias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sugerencias ALTER COLUMN id SET DEFAULT nextval('public.sugerencias_id_seq'::regclass);


--
-- Name: ubicaciones id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubicaciones ALTER COLUMN id SET DEFAULT nextval('public.ubicaciones_id_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Data for Name: calificaciones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.calificaciones (id, usuario_id, evento_id, puntuacion) FROM stdin;
\.


--
-- Data for Name: categorias; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categorias (id, nombre) FROM stdin;
1	Deportes
2	Ciencia y Tecnologia
3	Arte y Cultura
4	Orientacion Vocacional
5	Convivencia y Recreacion
\.


--
-- Data for Name: comentarios; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.comentarios (id, usuario_id, evento_id, texto, fecha) FROM stdin;
\.


--
-- Data for Name: encuestas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.encuestas (id, evento_id, titulo, pregunta_1, opciones_1, pregunta_2, opciones_2, pregunta_abierta, activa, fecha_creacion) FROM stdin;
\.


--
-- Data for Name: eventos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.eventos (id, titulo, descripcion, fecha, ubicacion_id, categoria_id, organizador_id, imagen_url, frase_motivacional, permite_voluntarios, resumen_pasado) FROM stdin;
1	Torneo Relampago de Microfutbol Intercursos	Gran torneo de microfutbol entre los salones de bachillerato en la cancha del colegio. Ven con tu uniforme deportivo o camiseta para apoyar a tu salon.	2026-09-18 10:00:00	1	1	2	img/cancha_futbol_ideth.jpeg	El talento gana partidos, pero el trabajo en equipo y el respeto ganan campeonatos.	t	El torneo intercursos anterior reunio a mas de 200 estudiantes en una jornada deportiva llena de emocion, donde el grado 11A se corono campeon.
3	Festival de Danza	Un evento organizado por la profesora Laiza Galindo, donde en cada curso varios grupos debían coordinar una coreografía para bailarla, de las cuales las mejores serian escogidas para bailar en frente de todo el colegio, teniendo como ganadores distintos tipos de géneros como el merengue, la salsa, la bachata, etc.	2026-09-15 07:00:00	1	3	5	/static/img/uploads/evento_e17c0bf108.jpeg	“Cuando el talento se une con la pasión, cada movimiento cuenta una historia.”	f	Todos los cursos participaron en una jornada de danza, formando grupos y preparando coreografías de diferentes géneros musicales. Fue una actividad llena de música, alegría y talento, que permitió compartir, trabajar en equipo y disfrutar juntos.
2	Dia del Amor y la Amistad	Un evento para celebrar el día del amor y la amistad junto a todos nuestros seres queridos en la escuela, con una temática de vestir de los 80´s y 90´s para que los estudiantes usen su creatividad al vestir	2026-09-18 07:00:00	5	5	1	/static/img/uploads/evento_032b0341ec.jpeg	“Compartir con los demás hace que cada momento sea más especial.”	f	Fue un día lleno de diversion, mucho amor y convivencia entre todos los estudiantes, compitiendo por ver que curso vestía mejor usando la moda de los 80´s y 90´s, y todos compartiendo con sus amigos y compañeros en sus respectivos salones
4	Carnavalores IDETH 2026	Evento cultural y festivo que celebra la tradición del Carnaval y los valores mediante música, danza y representaciones típicas. Reúne a los diferentes cursos en un espacio de alegría, creatividad y convivencia, con reinas, Reyes Momo, coreografías, comparsas y presentaciones musicales.	2026-02-12 09:50:00	1	3	5	/static/img/uploads/evento_4bc5a2f034.jpeg	“Nuestra cultura nos une y nos recuerda la alegría de ser quienes somos.”	f	Los carnavalores del ideth fueron una celebración llena de alegría, música y tradición. Varios cursos participaron presentando a sus reinas y Reyes Momo, realizando bailes y coloridas coreografías. Además, se contó con un grupo musical que llenó el ambiente de energía y diversión, creando un momento especial para toda la comunidad educativa.
5	Lanzamiento de la Promocion: Polaris 2026	Evento especial realizado en horas de la noche, alrededor de las 6:30 p. m., para lanzar oficialmente la Promoción 2026 “Polaris”. Un espacio de celebración y unión en el que los estudiantes dieron inicio a una nueva etapa, acompañados por sus familias, docentes y comunidad educativa.	2026-06-12 17:00:00	1	5	1	/static/img/uploads/evento_029f64612a.jpeg	“Hoy comienza un nuevo capítulo; juntos dejaremos una huella que recordaremos siempre.”	f	El lanzamiento de la Promoción 2026 “Polaris” fue una noche llena de emoción, orgullo y alegría. Los estudiantes hicieron su gran entrada mediante una coreografía, presentando oficialmente su uniforme y el escudo que representa a la promoción. Fue un momento especial que marcó el inicio de una nueva etapa y dejó un recuerdo inolvidable para todos los presentes.
6	Día prevención del suicidio	Es una fecha dedicada a crear conciencia sobre la importancia de la salud mental y la prevención del suicidio. Busca promover la empatía, la escucha y el apoyo hacia las personas que pueden estar pasando por momentos difíciles. También nos recuerda que hablar de lo que sentimos y buscar ayuda es un acto de valentía.	2026-09-10 08:00:00	1	5	4	/static/img/uploads/evento_ade4b0649d.jpeg	“Hablar, escuchar y acompañar puede cambiar una vida. Nunca estamos solos y siempre hay alguien dispuesto a escuchar.”	f	El evento del Día de la Prevención del Suicidio fue una jornada de reflexión, esperanza y superación. Contó con la participación de antiguas leyendas del Junior de Barranquilla, quienes compartieron experiencias y brindaron charlas motivacionales a los estudiantes. También se promovió el deporte mediante un partido con los estudiantes y se realizó una actividad en la que cada joven escribió y pegó una frase motivadora para la vida, creando un espacio de unión, apoyo y mensajes positivos.
7	Dia del Maestro	Es una fecha para reconocer y agradecer la dedicación de los docentes, quienes acompañan a los estudiantes en su aprendizaje y crecimiento. Es una oportunidad para valorar su esfuerzo, paciencia y compromiso con la educación.	2026-05-15 07:00:00	1	5	1	/static/img/uploads/evento_8652d62d74.jpeg	“Enseñar es dejar una huella que permanece mucho después de terminar una clase.”	f	El Día del Maestro se celebró con una temática especial inspirada en una gran alfombra roja, donde nuestros maestros fueron las verdaderas estrellas de la jornada. Entre elegancia, música, aplausos y mucha alegría, se reconoció su dedicación, esfuerzo y compromiso con los estudiantes. Fue un momento para salir de la rutina, compartir, reír y agradecer a quienes día a día dejan huella en nuestra formación. ¡Porque si alguien merecía pasar por esa alfombra roja, eran ellos!
8	Dia de la Mujer	Es una fecha para reconocer el valor, los aportes y los logros de las mujeres en la sociedad. También invita a reflexionar sobre la importancia del respeto, la igualdad de oportunidades y la eliminación de la discriminación.	2026-03-08 09:00:00	1	5	1	/static/img/uploads/evento_212e453032.jpeg	“Cada mujer tiene una historia, una voz y un camino capaz de inspirar a los demás.”	f	El Día de la Mujer fue un dia especial de reconocimiento y celebración para todas las mujeres de la institución. Los hombres realizamos diferentes actividades y detalles para homenajearlas, compartiendo momentos de alegría y compañerismo. Además, se disfrutaron deliciosos helados como parte de la celebración, creando un ambiente agradable y lleno de buenos momentos.
9	Día del Hombre	Es una fecha que busca reconocer los aportes de los hombres a la familia, la sociedad y la comunidad. También promueve valores como el respeto, la responsabilidad, la solidaridad y el cuidado de la salud física y emocional.	2026-03-19 08:00:00	1	5	1	\N	Ser un buen hombre también significa saber respetar, apoyar, escuchar y crecer junto a los demás.	f	Un dia pensado para compartir y reconocer a los hombres de nuestra institución. Las mujeres fueron las encargadas de preparar actividades y diferentes detalles para hacerlos sentir especiales, generando momentos de diversión, integración y compañerismo. Para cerrar la celebración, se compartieron helados, dejando un recuerdo agradable de este día.
10	Novena	Es un espacio de encuentro y reflexión en el que la comunidad educativa se reúne para compartir, fortalecer la unión y vivir el espíritu de la Navidad. Es una oportunidad para disfrutar juntos, agradecer por lo vivido durante el año y compartir momentos especiales.	2026-11-01 07:00:00	2	5	5	\N	La Navidad se vuelve más especial cuando la vivimos unidos, compartiendo alegría, esperanza y gratitud.	f	\N
11	Semana del Idioma – Teatro	Durante la Semana del Idioma, tuvimos la oportunidad de visitar la Fábrica de Cultura de Barranquilla, donde disfrutamos de diferentes obras de teatro, dramatizaciones y presentaciones artísticas. Esta actividad nos permitió acercarnos al arte y la literatura de una manera diferente, fortaleciendo nuestra creatividad y apreciación por la expresión cultural.	2026-04-27 08:00:00	2	3	5	/static/img/uploads/evento_2c9b9ca0d3.jpeg	El teatro convierte las palabras en historias, y las historias en experiencias que nunca olvidamos.	f	Fue una jornada cultural en la Fábrica de Cultura, donde tuvimos la oportunidad de apreciar las diferentes obras y presentaciones realizadas por los estudiantes de los grados 6.º a 11.º. Algunos estudiantes también participaron apoyando la logística del evento, desempeñándose como encargados de staff y orientando a los asistentes. Fue un espacio para disfrutar del talento, la creatividad y el esfuerzo de nuestros compañeros, fortaleciendo la integración y el sentido de comunidad.
12	Día de la Tierra	Es una fecha que busca crear conciencia sobre la importancia de proteger nuestro planeta y sus recursos naturales. Nos invita a reflexionar sobre cómo nuestras acciones afectan al medio ambiente y a promover hábitos que ayuden a construir un futuro más sostenible.	2026-06-10 08:00:00	5	2	3	/static/img/uploads/evento_e6e32ab9b3.jpeg	La Tierra es nuestro hogar; cuidarla hoy es asegurar un mejor mañana.	f	El Día de la Tierra fue una jornada dedicada a reflexionar sobre la importancia de cuidar nuestro planeta. Durante el evento recibimos invitados que compartieron información y mensajes sobre la protección del medio ambiente, el uso responsable de los recursos y la importancia de nuestras acciones diarias. Fue un espacio para aprender, crear conciencia y recordar que cuidar la Tierra es una responsabilidad de todos.
\.


--
-- Data for Name: inscripciones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inscripciones (id, usuario_id, evento_id, fecha_registro, tipo_participacion, detalle_participacion) FROM stdin;
\.


--
-- Data for Name: organizadores; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organizadores (id, nombre) FROM stdin;
1	Consejo Estudiantil 11
2	Area de Educacion Fisica
3	Club de Ciencias y Robotica
4	Psicorientacion Escolar
5	Comite de Cultura
\.


--
-- Data for Name: reportes_problemas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reportes_problemas (id, usuario_id, evento_id, tipo_problema, descripcion, estado, fecha) FROM stdin;
\.


--
-- Data for Name: respuestas_encuestas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.respuestas_encuestas (id, encuesta_id, usuario_id, respuesta_1, respuesta_2, respuesta_abierta, fecha) FROM stdin;
\.


--
-- Data for Name: sugerencias; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sugerencias (id, usuario_id, texto, fecha) FROM stdin;
\.


--
-- Data for Name: ubicaciones; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ubicaciones (id, nombre) FROM stdin;
1	Cancha Multiple Principal
2	Auditorio Simon Bolivar
3	Laboratorio de Fisica y Robotica
4	Biblioteca Escolar
5	Patio Central
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.usuarios (id, nombre, email, password_hash, rol) FROM stdin;
1	Profesor Admin	admin@ideth.edu	$2b$12$NveFvE8Y/XrKu3sD6CJoweTFJsCUVK.jlhFLmM0N9Xt.Yv37JBRB.	admin
2	Camila Rodriguez (11A)	estudiante@ideth.edu	$2b$12$UStcoNQYXmjW2x1rbpTLJus.I8kgEfpCTmuqsvjWyG/kICjeUbsuK	estudiante
3	Santiago Gomez (11B)	santiago@ideth.edu	$2b$12$UStcoNQYXmjW2x1rbpTLJus.I8kgEfpCTmuqsvjWyG/kICjeUbsuK	estudiante
4	Gabriel Angarita 11B	gaboekisdeunodostres@gmail.com	$2b$12$DFNnlgzt6VK9wlRtKWsT0.LPTz.Cq1.aU1qgsA2Gf2yhwGxFcJPp2	estudiante
5	Diego Angarita 11A	prueba67@gmail.com	$2b$12$/BFQzn0Su9XDwGQu3B0CXO2SxD.9fgGwN9Xe11MhewqDb3HslKiuO	estudiante
\.


--
-- Name: calificaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.calificaciones_id_seq', 1, false);


--
-- Name: categorias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categorias_id_seq', 5, true);


--
-- Name: comentarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.comentarios_id_seq', 1, false);


--
-- Name: encuestas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.encuestas_id_seq', 1, false);


--
-- Name: eventos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.eventos_id_seq', 12, true);


--
-- Name: inscripciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inscripciones_id_seq', 1, false);


--
-- Name: organizadores_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.organizadores_id_seq', 5, true);


--
-- Name: reportes_problemas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reportes_problemas_id_seq', 1, false);


--
-- Name: respuestas_encuestas_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.respuestas_encuestas_id_seq', 1, false);


--
-- Name: sugerencias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sugerencias_id_seq', 1, false);


--
-- Name: ubicaciones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ubicaciones_id_seq', 5, true);


--
-- Name: usuarios_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.usuarios_id_seq', 5, true);


--
-- Name: calificaciones calificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_pkey PRIMARY KEY (id);


--
-- Name: calificaciones calificaciones_usuario_id_evento_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_usuario_id_evento_id_key UNIQUE (usuario_id, evento_id);


--
-- Name: categorias categorias_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key UNIQUE (nombre);


--
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id);


--
-- Name: comentarios comentarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios
    ADD CONSTRAINT comentarios_pkey PRIMARY KEY (id);


--
-- Name: encuestas encuestas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuestas
    ADD CONSTRAINT encuestas_pkey PRIMARY KEY (id);


--
-- Name: eventos eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_pkey PRIMARY KEY (id);


--
-- Name: inscripciones inscripciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_pkey PRIMARY KEY (id);


--
-- Name: inscripciones inscripciones_usuario_id_evento_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_usuario_id_evento_id_key UNIQUE (usuario_id, evento_id);


--
-- Name: organizadores organizadores_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizadores
    ADD CONSTRAINT organizadores_nombre_key UNIQUE (nombre);


--
-- Name: organizadores organizadores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizadores
    ADD CONSTRAINT organizadores_pkey PRIMARY KEY (id);


--
-- Name: reportes_problemas reportes_problemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes_problemas
    ADD CONSTRAINT reportes_problemas_pkey PRIMARY KEY (id);


--
-- Name: respuestas_encuestas respuestas_encuestas_encuesta_id_usuario_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas_encuestas
    ADD CONSTRAINT respuestas_encuestas_encuesta_id_usuario_id_key UNIQUE (encuesta_id, usuario_id);


--
-- Name: respuestas_encuestas respuestas_encuestas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas_encuestas
    ADD CONSTRAINT respuestas_encuestas_pkey PRIMARY KEY (id);


--
-- Name: sugerencias sugerencias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sugerencias
    ADD CONSTRAINT sugerencias_pkey PRIMARY KEY (id);


--
-- Name: ubicaciones ubicaciones_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubicaciones
    ADD CONSTRAINT ubicaciones_nombre_key UNIQUE (nombre);


--
-- Name: ubicaciones ubicaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ubicaciones
    ADD CONSTRAINT ubicaciones_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: calificaciones calificaciones_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;


--
-- Name: calificaciones calificaciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calificaciones
    ADD CONSTRAINT calificaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: comentarios comentarios_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios
    ADD CONSTRAINT comentarios_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;


--
-- Name: comentarios comentarios_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comentarios
    ADD CONSTRAINT comentarios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: encuestas encuestas_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuestas
    ADD CONSTRAINT encuestas_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;


--
-- Name: eventos eventos_categoria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id) ON DELETE SET NULL;


--
-- Name: eventos eventos_organizador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_organizador_id_fkey FOREIGN KEY (organizador_id) REFERENCES public.organizadores(id) ON DELETE SET NULL;


--
-- Name: eventos eventos_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES public.ubicaciones(id) ON DELETE SET NULL;


--
-- Name: inscripciones inscripciones_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;


--
-- Name: inscripciones inscripciones_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: reportes_problemas reportes_problemas_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes_problemas
    ADD CONSTRAINT reportes_problemas_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE SET NULL;


--
-- Name: reportes_problemas reportes_problemas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reportes_problemas
    ADD CONSTRAINT reportes_problemas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: respuestas_encuestas respuestas_encuestas_encuesta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas_encuestas
    ADD CONSTRAINT respuestas_encuestas_encuesta_id_fkey FOREIGN KEY (encuesta_id) REFERENCES public.encuestas(id) ON DELETE CASCADE;


--
-- Name: respuestas_encuestas respuestas_encuestas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.respuestas_encuestas
    ADD CONSTRAINT respuestas_encuestas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: sugerencias sugerencias_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sugerencias
    ADD CONSTRAINT sugerencias_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict pa25ZEJX2HIYNbpj2UOr7B4gg0NkBrZq0ihqWcZekUE6CbyEtm1m8WMYggBZg8O

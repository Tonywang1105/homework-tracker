// The app's words in English, Chinese and Spanish, and t() to look one up in the chosen language. No DOM, so it can
// be unit-tested with Node. English is the default, so code and tests that never choose a language read as before.
// Assignments' own titles, courses and notes are never translated: only the app's words.

export const LANGUAGES = ["en", "zh", "es"];
// Each language named in itself, as the Settings buttons show it.
export const LANGUAGE_NAMES = { en: "English", zh: "中文", es: "Español" };
// The locale each language formats dates with, and the page's lang attribute.
export const DATE_LOCALES = { en: "en-US", zh: "zh-CN", es: "es-ES" };
export const HTML_LANGS = { en: "en", zh: "zh-CN", es: "es" };

// key: [English, 中文, Español]. {name} is filled in by t(). Keys ending .one/.other are a count's singular and plural.
const PHRASES = {
  // Header
  "header.tagline": ["Everything due, soonest first, with your own notes.", "所有待办，按截止时间排序，附上你自己的笔记。", "Todo lo pendiente, lo más próximo primero, con tus propias notas."],
  "account.sign_in": ["Sign in to sync", "登录以同步", "Inicia sesión para sincronizar"],

  // The form
  "form.add_toggle": ["+ Add assignment", "+ 添加作业", "+ Añadir tarea"],
  "form.heading_add": ["Add an assignment", "添加作业", "Añadir una tarea"],
  "form.heading_edit": ["Edit assignment", "编辑作业", "Editar tarea"],
  "form.heading_extend": ['Extend "{title}"', "延期「{title}」", "Prorrogar «{title}»"],
  "form.hint": [
    "Only a name and a due date are needed. Everything else is optional.",
    "只需填写名称和截止日期，其他都是可选的。",
    "Solo hacen falta un nombre y una fecha de entrega. Todo lo demás es opcional.",
  ],
  "form.required": ["required", "必填", "obligatorio"],
  "form.optional": ["optional", "可选", "opcional"],
  "form.assignment": ["Assignment", "作业", "Tarea"],
  "form.title_ph": ["e.g. MP2: Checkpoint 1", "例如：MP2: Checkpoint 1", "p. ej., MP2: Checkpoint 1"],
  "form.course": ["Course", "课程", "Curso"],
  "form.course_ph": ["e.g. CS 124", "例如：CS 124", "p. ej., CS 124"],
  "form.due_date": ["Due date", "截止日期", "Fecha de entrega"],
  "form.date_ph": ["yyyy/mm/dd", "年/月/日", "aaaa/mm/dd"],
  "form.time": ["Time", "时间", "Hora"],
  "form.size": ["Size", "大小", "Tamaño"],
  "form.size_assignment": ["assignment", "作业", "(tarea)"],
  "form.size_reminder": ["reminder", "提醒", "(recordatorio)"],
  "form.type": ["Type", "类型", "Tipo"],
  "form.type_guess": ["Guess from title", "根据标题猜测", "Adivinar por el título"],
  "form.type_none": ["None", "无", "Ninguno"],
  "form.where": ["Where", "在哪里完成", "Dónde"],
  "form.where_note": ["optional, where it's done", "可选，在哪个平台完成", "opcional, dónde se hace"],
  "form.not_set": ["Not set", "未设置", "Sin indicar"],
  "form.hours": ["Time needed", "所需时间", "Tiempo necesario"],
  "form.hours_note": ["hours, optional", "小时，可选", "horas, opcional"],
  "form.hours_ph": ["e.g. 2", "例如：2", "p. ej., 2"],
  "form.repeat": ["Repeat", "重复", "Repetir"],
  "form.repeat_none": ["Doesn't repeat", "不重复", "No se repite"],
  "form.repeat_weekly": ["Weekly", "每周", "Cada semana"],
  "form.repeat_biweekly": ["Every 2 weeks", "每两周", "Cada 2 semanas"],
  "form.until": ["Until", "直到", "Hasta"],
  "form.steps": ["Steps", "步骤", "Pasos"],
  "form.topics": ["Topics to study", "复习主题", "Temas para estudiar"],
  "form.steps_note": ["optional, one per line", "可选，每行一个", "opcional, uno por línea"],
  "form.steps_ph": [
    "e.g. Checkpoint 1 (then Checkpoint 2 on the next line)",
    "例如：Checkpoint 1（下一行写 Checkpoint 2）",
    "p. ej., Checkpoint 1 (y Checkpoint 2 en la línea siguiente)",
  ],
  "form.topics_ph": [
    "e.g. Eigenvalues (then the next topic on the next line)",
    "例如：特征值（下一行写下一个主题）",
    "p. ej., Autovalores (y el siguiente tema en la línea siguiente)",
  ],
  "form.notes": ["Notes", "备注", "Notas"],
  "form.notes_ph": ["Slides to review, hints, links…", "要复习的幻灯片、提示、链接……", "Diapositivas que repasar, pistas, enlaces…"],
  "form.submit_add": ["Add assignment", "添加作业", "Añadir tarea"],
  "form.submit_save": ["Save changes", "保存修改", "Guardar cambios"],
  "form.submit_extend": ["Save new date", "保存新日期", "Guardar nueva fecha"],
  "form.cancel": ["Cancel", "取消", "Cancelar"],

  // Sizes and types, wherever they appear
  "size.big": ["Big", "大型", "Grande"],
  "size.regular": ["Regular", "普通", "Normal"],
  "size.small": ["Small", "小型", "Pequeño"],
  "type.exam": ["Exam", "考试", "Examen"],
  "type.quiz": ["Quiz", "小测", "Cuestionario"],
  "type.mp": ["MP", "MP", "MP"],
  "type.lab": ["Lab", "实验", "Laboratorio"],
  "type.homework": ["Homework", "作业", "Tarea"],
  "type.reading": ["Reading", "阅读", "Lectura"],

  // The list, its views and filters
  "list.todo": ["To do", "待办", "Pendiente"],
  "list.completed": ["Completed", "已完成", "Completadas"],
  "list.show_older": ["Show {n} older", "显示更早的 {n} 项", "Mostrar {n} anteriores"],
  "list.series_more": ["+{n} more in this series", "本系列还有 {n} 项", "+{n} más de esta serie"],
  "list.series_hide": ["Hide the {n} later ones", "隐藏后面的 {n} 项", "Ocultar las {n} siguientes"],
  "view.list": ["List", "列表", "Lista"],
  "view.calendar": ["Calendar", "日历", "Calendario"],
  "view.agenda": ["Agenda", "日程", "Agenda"],
  "quick.label": ["Quick add", "快速添加", "Añadir rápido"],
  "quick.add": ["Add", "添加", "Añadir"],
  "start.empty": [
    "No assignments yet. Add one with the form, use Import from Canvas below, or see how the app works with some examples.",
    "还没有作业。用表单添加一项、从下方的 Canvas 导入，或者先用示例看看应用怎么用。",
    "Aún no hay tareas. Añade una con el formulario, importa de Canvas abajo o mira cómo funciona con unos ejemplos.",
  ],
  "start.try": ["Try with example assignments", "用示例作业试试", "Probar con tareas de ejemplo"],
  "examples.notice": ["You're looking at example assignments.", "你正在看示例作业。", "Estás viendo tareas de ejemplo."],
  "examples.remove": ["Remove them", "移除示例", "Quitarlas"],
  "quick.help": [
    "Type a title, a day (fri, tomorrow, 10/30) and, if you like, a course, time, size (big, small) or hours (2h).",
    "输入标题和日期（fri、tomorrow、10/30），也可以加上课程、时间、大小（big、small）或时长（2h）。日期等词用英文。",
    "Escribe un título, un día (fri, tomorrow, 10/30) y, si quieres, un curso, hora, tamaño (big, small) u horas (2h). Esas palabras van en inglés.",
  ],
  "filter.search": ["Search", "搜索", "Buscar"],
  "filter.course": ["Course", "课程", "Curso"],
  "filter.all_courses": ["All courses", "所有课程", "Todos los cursos"],
  "filter.where": ["Where", "平台", "Dónde"],
  "filter.anywhere": ["Anywhere", "所有平台", "En cualquier sitio"],
  "filter.show_small": ["Show small reminders", "显示小提醒", "Mostrar recordatorios"],
  "filter.hide_done": ["Hide completed", "隐藏已完成", "Ocultar completadas"],
  "filter.select": ["Select", "选择", "Seleccionar"],
  "filter.done_selecting": ["Done selecting", "完成选择", "Terminar selección"],
  "select.mark_done": ["Mark done", "标记完成", "Marcar como hecha"],
  "select.size": ["Size…", "大小…", "Tamaño…"],
  "select.delete": ["Delete", "删除", "Eliminar"],
  "select.all": ["Select all shown", "全选当前显示", "Seleccionar todo lo visible"],
  "select.cancel": ["Cancel", "取消", "Cancelar"],
  "select.none": ["Tick the ones to change", "勾选要修改的项目", "Marca las que quieras cambiar"],
  "select.count": ["{n} selected", "已选 {n} 项", "{n} seleccionadas"],

  // Row buttons and tags
  "action.start": ["Start", "开始", "Empezar"],
  "action.stop": ["Stop", "停止", "Parar"],
  "action.tomorrow": ["Tomorrow", "明天", "Mañana"],
  "action.extend": ["Extend…", "延期…", "Prorrogar…"],
  "action.edit": ["Edit", "编辑", "Editar"],
  "action.copy": ["Copy", "复制", "Copiar"],
  "action.delete": ["Delete", "删除", "Eliminar"],
  "tag.overdue": ["Overdue", "已逾期", "Atrasada"],
  "tag.start_by": ["start by {day}", "最晚 {day} 开始", "empezar antes del {day}"],
  "tag.start_today": ["start today", "今天开始", "empezar hoy"],
  "tag.behind": ["behind: {hours} short", "落后：还差 {hours}", "retrasada: faltan {hours}"],
  "tag.steps": ["{done} of {total} steps", "{done}/{total} 步", "{done} de {total} pasos"],
  "tag.extended": ["extended from {day}", "原定 {day}", "prorrogada desde el {day}"],
  "step.today": ["today", "今天", "hoy"],
  "steps.hint": ['Add "Time needed" to spread these over days.', "填写「所需时间」即可把这些分配到各天。", "Añade «Tiempo necesario» para repartirlos en varios días."],

  // Due times and amounts of time
  "due.in": ["due in {amount}", "{amount}后截止", "vence en {amount}"],
  "due.overdue": ["overdue by {amount}", "已逾期 {amount}", "atrasada {amount}"],
  "unit.minute.one": ["1 minute", "1 分钟", "1 minuto"],
  "unit.minute.other": ["{n} minutes", "{n} 分钟", "{n} minutos"],
  "unit.hour.one": ["1 hour", "1 小时", "1 hora"],
  "unit.hour.other": ["{n} hours", "{n} 小时", "{n} horas"],
  "unit.day.one": ["1 day", "1 天", "1 día"],
  "unit.day.other": ["{n} days", "{n} 天", "{n} días"],
  "hours.h": ["~{n} h", "约 {n} 小时", "~{n} h"],
  "hours.min": ["~{n} min", "约 {n} 分钟", "~{n} min"],
  "count.assignments.one": ["1 assignment", "1 项作业", "1 tarea"],
  "count.assignments.other": ["{n} assignments", "{n} 项作业", "{n} tareas"],

  // The timer
  "timer.working": ["Working… {clock}", "进行中… {clock}", "Trabajando… {clock}"],
  "timer.focus": ["Focus {clock} left", "专注：剩余 {clock}", "Concentración: quedan {clock}"],
  "spent.unfinished": ["spent {spent}{estimate}", "已用 {spent}{estimate}", "llevas {spent}{estimate}"],
  "spent.done": ["took {spent}{estimate}", "共用 {spent}{estimate}", "llevó {spent}{estimate}"],
  "spent.estimate": [" of ~{hours}", "（预计 {hours}）", " de ~{hours}"],
  "spent.under_minute": ["under 1 min", "不到 1 分钟", "menos de 1 min"],
  "spent.minutes": ["{n} min", "{n} 分钟", "{n} min"],
  "spent.hours": ["{n} h", "{n} 小时", "{n} h"],

  // Today's plan
  "plan.heading": ["Today's plan", "今日计划", "Plan de hoy"],
  "plan.total": ["{hours} of work", "共 {hours}", "{hours} de trabajo"],
  "plan.today_hours": ["{hours} today", "今天 {hours}", "{hours} hoy"],
  "plan.of_left": [" of {hours} left", "（还剩 {hours}）", " de {hours} restantes"],
  "plan.ahead": [" · getting ahead", " · 提前进行", " · adelantando"],
  "plan.study": ["Study: {list}", "复习：{list}", "Estudiar: {list}"],
  "plan.steps": ["Steps: {list}", "步骤：{list}", "Pasos: {list}"],
  "plan.nothing": ["Nothing planned for today.", "今天没有计划。", "Nada planeado para hoy."],
  "plan.nothing_else": ["Nothing else planned for today.", "今天没有其他计划。", "Nada más planeado para hoy."],
  "plan.add_estimates": [
    ' Add "Time needed" to assignments so the plan can fit them into your days.',
    "给作业填写「所需时间」，计划才能把它们安排到每一天。",
    " Añade «Tiempo necesario» a las tareas para que el plan las reparta en tus días.",
  ],

  // The summary line
  "summary.today": ["Today:", "今天：", "Hoy:"],
  "summary.nothing_due": ["nothing due", "没有到期", "nada pendiente"],
  "summary.due": ["{n} due ({names}{more})", "{n} 项到期（{names}{more}）", "{n} para hoy ({names}{more})"],
  "summary.more": [", +{n} more", "，另有 {n} 项", ", +{n} más"],
  "summary.overdue": ["{n} overdue", "{n} 项逾期", "{n} atrasadas"],
  "summary.week": ["This week:", "本周：", "Esta semana:"],
  "summary.week_done": ["{done} of {due} done", "已完成 {done}/{due}", "{done} de {due} hechas"],
  "summary.streak": ["{n}-day streak", "连续 {n} 天", "racha de {n} días"],
  "summary.review": ["Weekly review", "每周回顾", "Resumen semanal"],

  // The workload line and empty list messages
  "work.next7": ["Next 7 days: ", "未来 7 天：", "Próximos 7 días: "],
  "work.no_hours": ['{count} · add "Time needed" to see how much work that is.', "{count} · 填写「所需时间」即可看到工作量。", "{count} · añade «Tiempo necesario» para ver cuánto trabajo es."],
  "work.of_work": ["{hours} of work", "共 {hours}", "{hours} de trabajo"],
  "work.busiest": ["busiest: {day} ({hours})", "最忙：{day}（{hours}）", "día más cargado: {day} ({hours})"],
  "work.unestimated": ["{n} without an estimate", "{n} 项未估时", "{n} sin estimación"],
  "empty.caught_up": ["All caught up. Nothing left to do.", "全部完成，没有待办了。", "Todo al día. No queda nada pendiente."],
  "empty.course": ["Nothing left to do for {course}.", "{course} 没有待办了。", "No queda nada pendiente de {course}."],
  "empty.platform": ["Nothing left to do on {place}.", "{place} 上没有待办了。", "No queda nada pendiente en {place}."],
  "empty.only_small": ["Nothing left but small reminders.", "只剩小提醒了。", "Solo quedan recordatorios."],
  "empty.small_hidden": [" Small reminders are hidden.", "小提醒已隐藏。", " Los recordatorios están ocultos."],
  "empty.search_none": ["Nothing matches {search}.", "没有与 {search} 匹配的内容。", "Nada coincide con {search}."],
  "empty.search_done": [
    "Nothing left to do matches {search}. Finished work that matches is below.",
    "没有与 {search} 匹配的待办，匹配的已完成项目在下方。",
    "Ninguna tarea pendiente coincide con {search}. Las terminadas que coinciden están abajo.",
  ],
  "empty.search_course": [" Only {course} is searched.", "只搜索了 {course}。", " Solo se busca en {course}."],

  // The links at the bottom and Settings
  "links.review": ["Weekly review…", "每周回顾…", "Resumen semanal…"],
  "links.canvas": ["Import from Canvas…", "从 Canvas 导入…", "Importar de Canvas…"],
  "links.export": ["Export to calendar…", "导出到日历…", "Exportar al calendario…"],
  "links.backup": ["Backup & restore…", "备份与恢复…", "Copia de seguridad…"],
  "links.settings": ["Settings…", "设置…", "Ajustes…"],
  "settings.planning": ["Planning", "规划", "Planificación"],
  "settings.plan_for": ["Plan for", "每天计划", "Planificar"],
  "settings.hours_a_day": ["hours of homework a day", "小时作业", "horas de tarea al día"],
  "settings.plan_help": [
    "Start-by dates and Today's plan fit work into this many hours a day.",
    "「最晚开始」日期和今日计划会按每天这么多小时来安排。",
    "Las fechas de inicio y el plan de hoy reparten el trabajo en estas horas al día.",
  ],
  "settings.focus": ["Focus blocks", "专注时段", "Bloques de concentración"],
  "settings.focus_on": ["Run the timer in blocks with breaks", "计时器分段运行，中间休息", "Usar el temporizador en bloques con descansos"],
  "settings.min_work": ["min work,", "分钟专注，", "min de trabajo,"],
  "settings.min_break": ["min break", "分钟休息", "min de descanso"],
  "settings.colors": ["Course colors", "课程颜色", "Colores de los cursos"],
  "settings.colors_help": [
    "Each course's tag has its own color, picked automatically. Choose a different one here.",
    "每门课程的标签都有自动分配的颜色，可以在这里更换。",
    "Cada curso tiene su propio color, elegido automáticamente. Puedes cambiarlo aquí.",
  ],
  "settings.automatic": ["Automatic", "自动", "Automático"],
  "settings.no_courses": ["No courses yet.", "还没有课程。", "Aún no hay cursos."],
  "color.blue": ["Blue", "蓝色", "Azul"],
  "color.teal": ["Teal", "青色", "Verde azulado"],
  "color.green": ["Green", "绿色", "Verde"],
  "color.olive": ["Olive", "橄榄色", "Oliva"],
  "color.purple": ["Purple", "紫色", "Morado"],
  "color.pink": ["Pink", "粉色", "Rosa"],
  "color.brown": ["Brown", "棕色", "Marrón"],
  "color.slate": ["Slate", "灰蓝色", "Pizarra"],
  "settings.appearance": ["Appearance", "外观", "Apariencia"],
  "theme.system": ["System", "跟随系统", "Sistema"],
  "theme.light": ["Light", "浅色", "Claro"],
  "theme.dark": ["Dark", "深色", "Oscuro"],
  "settings.shortcuts": ["Keyboard shortcuts", "快捷键", "Atajos de teclado"],
  "settings.shortcuts_help": ["Press these keys anywhere except while typing in a box.", "在任意位置按这些键即可（输入框中除外）。", "Pulsa estas teclas en cualquier sitio, salvo mientras escribes en un cuadro."],
  "shortcut.add": ["Add an assignment", "添加作业", "Añadir una tarea"],
  "shortcut.search": ["Search", "搜索", "Buscar"],
  "shortcut.view": ["Switch between List, Calendar and Agenda", "在列表、日历和日程之间切换", "Cambiar entre Lista, Calendario y Agenda"],
  "shortcut.help": ["Show these shortcuts", "显示这些快捷键", "Mostrar estos atajos"],
  "settings.deleted": ["Recently deleted", "最近删除", "Eliminadas recientemente"],
  "settings.deleted_help": [
    "Deleted assignments are kept here for 30 days, on all your devices, then removed for good.",
    "删除的作业会在所有设备上保留 30 天，之后永久删除。",
    "Las tareas eliminadas se guardan aquí 30 días, en todos tus dispositivos, y luego se borran del todo.",
  ],
  "settings.deleted_none": ["Nothing deleted in the last 30 days.", "最近 30 天没有删除任何内容。", "No se ha eliminado nada en los últimos 30 días."],
  "settings.deleted_row": ["deleted {ago}", "{ago}删除", "eliminada {ago}"],
  "settings.restore": ["Restore", "恢复", "Restaurar"],
  "settings.delete_all": ["Delete all now", "立即全部删除", "Eliminar todo ahora"],
  "ago.now": ["just now", "刚刚", "hace un momento"],
  "ago.hours.one": ["1 hour ago", "1 小时前", "hace 1 hora"],
  "ago.hours.other": ["{n} hours ago", "{n} 小时前", "hace {n} horas"],
  "ago.days.one": ["1 day ago", "1 天前", "hace 1 día"],
  "ago.days.other": ["{n} days ago", "{n} 天前", "hace {n} días"],
  "settings.help": ["Help", "帮助", "Ayuda"],
  "settings.tour": ["Show the tour again", "再看一遍导览", "Ver la guía de nuevo"],
  "settings.close": ["Close", "关闭", "Cerrar"],
};

let current = "en";

/** Chooses the language t() uses; anything unknown means English. */
export function setLanguage(language) {
  current = LANGUAGES.includes(language) ? language : "en";
}

export function getLanguage() {
  return current;
}

/** A phrase in the chosen language, with each {name} filled in from `values`. Unknown keys come back as the key. */
export function t(key, values = {}) {
  const phrase = PHRASES[key]?.[LANGUAGES.indexOf(current)] ?? key;
  return phrase.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
}

/** A phrase for a count, using its .one form for exactly 1 and its .other form otherwise: "1 day", "3 days". */
export function tCount(key, n) {
  return t(`${key}.${n === 1 ? "one" : "other"}`, { n });
}

/**
 * The language to start in: the one chosen in Settings on this device, or else the browser's own if it's Chinese or
 * Spanish, or else English.
 */
export function pickLanguage(saved, browserLanguages = []) {
  if (LANGUAGES.includes(saved)) {
    return saved;
  }
  const browser = browserLanguages.map((tag) => String(tag).toLowerCase().split("-")[0]).find((code) => LANGUAGES.includes(code));
  return browser ?? "en";
}

/** Every phrase's key and its three versions, for the test that checks none is missing. */
export function allPhrases() {
  return Object.entries(PHRASES);
}

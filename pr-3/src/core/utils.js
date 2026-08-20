/**
 * Web-CS15
 * src/core/utils.js
 *
 * 通用工具函数。
 *
 * 这个文件不依赖 Three.js，不依赖其他游戏模块。
 * 任何系统都可以安全引用。
 *
 * 主要包含：
 * - 数学工具
 * - 随机工具
 * - 时间/冷却工具
 * - 简易事件系统
 * - ID 生成
 * - 数组工具
 * - Promise 延迟
 * - 数值插值
 * - 权重随机
 */

// ============================================================
// 数学工具
// ============================================================

/**
 * 限制数值范围
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * 0 ~ 1 限制
 */
export function clamp01(value) {
    return clamp(value, 0, 1);
}

/**
 * 线性插值
 */
export function lerp(a, b, t) {
    return a + (b - a) * clamp01(t);
}

/**
 * 反向线性插值
 */
export function inverseLerp(a, b, value) {
    if (a === b) return 0;

    return clamp01((value - a) / (b - a));
}

/**
 * 从一个范围映射到另一个范围
 */
export function remap(
    value,
    inMin,
    inMax,
    outMin,
    outMax
) {
    const t = inverseLerp(inMin, inMax, value);

    return lerp(outMin, outMax, t);
}

/**
 * 平滑插值
 */
export function smoothStep(t) {
    t = clamp01(t);

    return t * t * (3 - 2 * t);
}

/**
 * 更平滑的插值
 */
export function smootherStep(t) {
    t = clamp01(t);

    return (
        t *
        t *
        t *
        (
            t *
            (
                t * 6 - 15
            )
            + 10
        )
    );
}

/**
 * 角度转弧度
 */
export function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

/**
 * 弧度转角度
 */
export function radToDeg(radians) {
    return radians * 180 / Math.PI;
}

/**
 * 角度标准化到 -180 ~ 180
 */
export function normalizeAngleDegrees(angle) {
    angle %= 360;

    if (angle > 180) {
        angle -= 360;
    }

    if (angle < -180) {
        angle += 360;
    }

    return angle;
}

/**
 * 弧度标准化到 -PI ~ PI
 */
export function normalizeAngleRadians(angle) {
    const twoPI = Math.PI * 2;

    angle %= twoPI;

    if (angle > Math.PI) {
        angle -= twoPI;
    }

    if (angle < -Math.PI) {
        angle += twoPI;
    }

    return angle;
}

/**
 * 两个角之间的最短差值
 */
export function deltaAngleDegrees(current, target) {
    return normalizeAngleDegrees(target - current);
}

/**
 * 平滑旋转角度
 */
export function lerpAngleDegrees(current, target, t) {
    return (
        current +
        deltaAngleDegrees(current, target) *
        clamp01(t)
    );
}

/**
 * 两点平方距离
 *
 * 适合 AI 判断距离，
 * 可以避免 Math.sqrt，性能更好。
 */
export function distanceSquared2D(
    ax,
    az,
    bx,
    bz
) {
    const dx = bx - ax;
    const dz = bz - az;

    return dx * dx + dz * dz;
}

/**
 * 两点平面距离
 */
export function distance2D(
    ax,
    az,
    bx,
    bz
) {
    return Math.sqrt(
        distanceSquared2D(
            ax,
            az,
            bx,
            bz
        )
    );
}

/**
 * 三维距离平方
 */
export function distanceSquared3D(
    ax,
    ay,
    az,
    bx,
    by,
    bz
) {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;

    return (
        dx * dx +
        dy * dy +
        dz * dz
    );
}

/**
 * 三维距离
 */
export function distance3D(
    ax,
    ay,
    az,
    bx,
    by,
    bz
) {
    return Math.sqrt(
        distanceSquared3D(
            ax,
            ay,
            az,
            bx,
            by,
            bz
        )
    );
}

/**
 * 检查两个数是否接近
 */
export function approximately(
    a,
    b,
    epsilon = 0.0001
) {
    return Math.abs(a - b) <= epsilon;
}


// ============================================================
// 随机工具
// ============================================================

/**
 * min ~ max 随机小数
 */
export function randomRange(min, max) {
    return (
        min +
        Math.random() *
        (max - min)
    );
}

/**
 * min ~ max 随机整数
 *
 * 包含 min 和 max。
 */
export function randomInt(min, max) {
    return Math.floor(
        Math.random() *
        (max - min + 1)
    ) + min;
}

/**
 * true / false 随机
 */
export function randomBool(chance = 0.5) {
    return Math.random() < chance;
}

/**
 * 根据概率判断
 *
 * chance:
 *
 * 0 = 永远 false
 * 1 = 永远 true
 */
export function chance(probability) {
    return (
        Math.random() <
        clamp01(probability)
    );
}

/**
 * 从数组随机获取一个元素
 */
export function randomItem(array) {
    if (
        !Array.isArray(array) ||
        array.length === 0
    ) {
        return undefined;
    }

    return array[
        Math.floor(
            Math.random() *
            array.length
        )
    ];
}

/**
 * 随机获取数组元素并返回 index
 */
export function randomItemWithIndex(array) {
    if (
        !Array.isArray(array) ||
        array.length === 0
    ) {
        return {
            index: -1,
            value: undefined
        };
    }

    const index = Math.floor(
        Math.random() *
        array.length
    );

    return {
        index,
        value: array[index]
    };
}

/**
 * Fisher-Yates 洗牌
 *
 * 不修改原数组。
 */
export function shuffleArray(array) {
    const result = [...array];

    for (
        let i = result.length - 1;
        i > 0;
        i--
    ) {
        const j = Math.floor(
            Math.random() *
            (i + 1)
        );

        [
            result[i],
            result[j]
        ] = [
            result[j],
            result[i]
        ];
    }

    return result;
}

/**
 * 权重随机选择
 *
 * 示例：
 *
 * weightedRandom([
 *   { value: "attack", weight: 5 },
 *   { value: "defend", weight: 2 }
 * ])
 */
export function weightedRandom(entries) {
    if (
        !Array.isArray(entries) ||
        entries.length === 0
    ) {
        return undefined;
    }

    let totalWeight = 0;

    for (const entry of entries) {
        totalWeight += Math.max(
            0,
            entry.weight ?? 0
        );
    }

    if (totalWeight <= 0) {
        return entries[0]?.value;
    }

    let roll = Math.random() * totalWeight;

    for (const entry of entries) {
        roll -= Math.max(
            0,
            entry.weight ?? 0
        );

        if (roll <= 0) {
            return entry.value;
        }
    }

    return entries[
        entries.length - 1
    ].value;
}


// ============================================================
// 时间工具
// ============================================================

/**
 * 当前高精度时间
 *
 * 单位：毫秒
 */
export function now() {
    return performance.now();
}

/**
 * 秒转毫秒
 */
export function secondsToMs(seconds) {
    return seconds * 1000;
}

/**
 * 毫秒转秒
 */
export function msToSeconds(ms) {
    return ms / 1000;
}

/**
 * Promise delay
 *
 * await sleep(1000);
 */
export function sleep(ms) {
    return new Promise(
        resolve => setTimeout(
            resolve,
            ms
        )
    );
}


// ============================================================
// Cooldown
// ============================================================

/**
 * 单个冷却计时器
 *
 * 示例：
 *
 * const cooldown = new Cooldown(1000);
 *
 * if (cooldown.ready()) {
 *     shoot();
 *     cooldown.trigger();
 * }
 */
export class Cooldown {

    constructor(duration = 0) {
        this.duration = Math.max(
            0,
            duration
        );

        this.lastTriggerTime = -Infinity;
    }

    /**
     * 是否已经冷却完成
     */
    ready(currentTime = now()) {
        return (
            currentTime -
            this.lastTriggerTime
            >=
            this.duration
        );
    }

    /**
     * 触发冷却
     */
    trigger(currentTime = now()) {
        this.lastTriggerTime = currentTime;
    }

    /**
     * 如果 ready，
     * 自动 trigger。
     */
    tryTrigger(currentTime = now()) {

        if (!this.ready(currentTime)) {
            return false;
        }

        this.trigger(currentTime);

        return true;
    }

    /**
     * 剩余时间
     */
    remaining(currentTime = now()) {

        return Math.max(
            0,
            this.duration -
            (
                currentTime -
                this.lastTriggerTime
            )
        );
    }

    /**
     * 冷却完成百分比
     */
    progress(currentTime = now()) {

        if (this.duration <= 0) {
            return 1;
        }

        return clamp01(
            (
                currentTime -
                this.lastTriggerTime
            )
            /
            this.duration
        );
    }

    /**
     * 重置
     */
    reset() {
        this.lastTriggerTime = -Infinity;
    }

    /**
     * 立即进入冷却
     */
    block(currentTime = now()) {
        this.lastTriggerTime = currentTime;
    }

    /**
     * 修改冷却时间
     */
    setDuration(duration) {
        this.duration = Math.max(
            0,
            duration
        );

        return this;
    }
}


// ============================================================
// 随机 Cooldown
// ============================================================

/**
 * 用于 BOT Radio 等。
 *
 * 每次触发后自动随机一个新的冷却。
 */
export class RandomCooldown {

    constructor(
        minDuration,
        maxDuration
    ) {

        this.minDuration = Math.min(
            minDuration,
            maxDuration
        );

        this.maxDuration = Math.max(
            minDuration,
            maxDuration
        );

        this.duration = randomRange(
            this.minDuration,
            this.maxDuration
        );

        this.lastTriggerTime = -Infinity;
    }

    ready(currentTime = now()) {

        return (
            currentTime -
            this.lastTriggerTime
            >=
            this.duration
        );
    }

    trigger(currentTime = now()) {

        this.lastTriggerTime =
            currentTime;

        this.duration = randomRange(
            this.minDuration,
            this.maxDuration
        );
    }

    tryTrigger(currentTime = now()) {

        if (!this.ready(currentTime)) {
            return false;
        }

        this.trigger(currentTime);

        return true;
    }

    remaining(currentTime = now()) {

        return Math.max(
            0,
            this.duration -
            (
                currentTime -
                this.lastTriggerTime
            )
        );
    }

    reset() {

        this.lastTriggerTime =
            -Infinity;

        this.duration = randomRange(
            this.minDuration,
            this.maxDuration
        );
    }
}


// ============================================================
// Timer
// ============================================================

/**
 * Update 驱动计时器。
 *
 * 不使用 setInterval，
 * 更适合游戏 Loop。
 *
 * 示例：
 *
 * const timer = new GameTimer(3);
 *
 * timer.start();
 *
 * timer.update(delta);
 *
 * if (timer.finished) ...
 */
export class GameTimer {

    constructor(duration = 0) {

        this.duration =
            Math.max(
                0,
                duration
            );

        this.timeLeft =
            this.duration;

        this.running = false;

        this.finished = false;
    }

    start(duration = this.duration) {

        this.duration =
            Math.max(
                0,
                duration
            );

        this.timeLeft =
            this.duration;

        this.running = true;

        this.finished = false;

        return this;
    }

    stop() {

        this.running = false;

        return this;
    }

    reset() {

        this.timeLeft =
            this.duration;

        this.running = false;

        this.finished = false;

        return this;
    }

    update(delta) {

        if (
            !this.running ||
            this.finished
        ) {
            return false;
        }

        this.timeLeft -= delta;

        if (this.timeLeft <= 0) {

            this.timeLeft = 0;

            this.running = false;

            this.finished = true;

            return true;
        }

        return false;
    }

    get progress() {

        if (this.duration <= 0) {
            return 1;
        }

        return clamp01(
            1 -
            this.timeLeft /
            this.duration
        );
    }
}


// ============================================================
// EventEmitter
// ============================================================

/**
 * 简易游戏事件系统。
 *
 * 示例：
 *
 * events.on(
 *   "round:end",
 *   data => console.log(data)
 * );
 *
 * events.emit(
 *   "round:end",
 *   { winner: "ct" }
 * );
 */
export class EventEmitter {

    constructor() {

        this.listeners =
            new Map();
    }

    /**
     * 注册事件
     */
    on(eventName, callback) {

        if (
            typeof callback !==
            "function"
        ) {
            throw new TypeError(
                "Event callback must be a function."
            );
        }

        if (
            !this.listeners.has(
                eventName
            )
        ) {
            this.listeners.set(
                eventName,
                new Set()
            );
        }

        this.listeners
            .get(eventName)
            .add(callback);

        return () => {
            this.off(
                eventName,
                callback
            );
        };
    }

    /**
     * 注册一次性事件
     */
    once(eventName, callback) {

        const wrapper = (...args) => {

            this.off(
                eventName,
                wrapper
            );

            callback(...args);
        };

        return this.on(
            eventName,
            wrapper
        );
    }

    /**
     * 移除事件
     */
    off(eventName, callback) {

        const set =
            this.listeners.get(
                eventName
            );

        if (!set) {
            return;
        }

        set.delete(callback);

        if (set.size === 0) {
            this.listeners.delete(
                eventName
            );
        }
    }

    /**
     * 触发事件
     */
    emit(eventName, ...args) {

        const set =
            this.listeners.get(
                eventName
            );

        if (!set) {
            return;
        }

        // 复制一份防止 callback
        // 在 emit 中修改 listeners
        const callbacks =
            [...set];

        for (
            const callback
            of callbacks
        ) {
            try {
                callback(...args);
            } catch (error) {

                console.error(
                    `[EventEmitter] Error in "${eventName}"`,
                    error
                );
            }
        }
    }

    /**
     * 清空指定事件
     */
    clear(eventName) {

        if (
            eventName !== undefined
        ) {
            this.listeners.delete(
                eventName
            );

            return;
        }

        this.listeners.clear();
    }

    /**
     * 获取监听数量
     */
    listenerCount(eventName) {

        return (
            this.listeners.get(
                eventName
            )?.size ?? 0
        );
    }
}


// ============================================================
// 全局 Event Bus
// ============================================================

/**
 * 游戏各模块之间可以共享。
 *
 * 示例：
 *
 * import { gameEvents }
 * from "../core/utils.js";
 *
 * gameEvents.emit(
 *     GAME_EVENT.ROUND_END,
 *     data
 * );
 */
export const gameEvents =
    new EventEmitter();


// ============================================================
// ID 工具
// ============================================================

let internalID = 0;

/**
 * 生成递增 ID
 */
export function nextID(prefix = "id") {

    internalID++;

    return `${prefix}_${internalID}`;
}

/**
 * 重置 ID
 *
 * 一般只用于测试。
 */
export function resetIDs() {
    internalID = 0;
}


// ============================================================
// 数组工具
// ============================================================

/**
 * 安全删除数组元素
 */
export function removeFromArray(
    array,
    item
) {

    const index =
        array.indexOf(item);

    if (index === -1) {
        return false;
    }

    array.splice(index, 1);

    return true;
}

/**
 * 数组最后一个元素
 */
export function last(array) {

    if (
        !Array.isArray(array) ||
        array.length === 0
    ) {
        return undefined;
    }

    return array[
        array.length - 1
    ];
}

/**
 * 安全判断数组是否存在内容
 */
export function hasItems(array) {

    return (
        Array.isArray(array) &&
        array.length > 0
    );
}

/**
 * 从数组随机删除一个元素
 */
export function popRandom(array) {

    if (
        !Array.isArray(array) ||
        array.length === 0
    ) {
        return undefined;
    }

    const index = randomInt(
        0,
        array.length - 1
    );

    return array.splice(
        index,
        1
    )[0];
}


// ============================================================
// Object 工具
// ============================================================

/**
 * 安全获取嵌套对象
 *
 * getNested(
 *     config,
 *     "bot.radio.cooldown"
 * )
 */
export function getNested(
    object,
    path,
    fallback = undefined
) {

    if (
        !object ||
        typeof path !== "string"
    ) {
        return fallback;
    }

    const keys =
        path.split(".");

    let value = object;

    for (const key of keys) {

        if (
            value == null ||
            !Object.prototype.hasOwnProperty.call(
                value,
                key
            )
        ) {
            return fallback;
        }

        value = value[key];
    }

    return value;
}


// ============================================================
// 字符串工具
// ============================================================

/**
 * 数字补零
 */
export function padNumber(
    value,
    size = 2
) {

    return String(value)
        .padStart(
            size,
            "0"
        );
}

/**
 * 格式化时间
 *
 * 180 -> "03:00"
 */
export function formatTime(seconds) {

    seconds = Math.max(
        0,
        Math.floor(seconds)
    );

    const minutes =
        Math.floor(
            seconds / 60
        );

    const secs =
        seconds % 60;

    return (
        `${padNumber(minutes)}:` +
        `${padNumber(secs)}`
    );
}

/**
 * 首字母大写
 */
export function capitalize(text) {

    if (!text) return "";

    return (
        text.charAt(0)
            .toUpperCase()
        +
        text.slice(1)
    );
}


// ============================================================
// Tween
// ============================================================

/**
 * 简单数值 Tween
 *
 * 不负责 requestAnimationFrame，
 * 外部调用 update(delta)。
 */
export class ValueTween {

    constructor(value = 0) {

        this.value = value;

        this.startValue = value;

        this.targetValue = value;

        this.duration = 0;

        this.elapsed = 0;

        this.active = false;
    }

    to(
        target,
        duration
    ) {

        this.startValue =
            this.value;

        this.targetValue =
            target;

        this.duration =
            Math.max(
                0.0001,
                duration
            );

        this.elapsed = 0;

        this.active = true;

        return this;
    }

    update(delta) {

        if (!this.active) {
            return this.value;
        }

        this.elapsed += delta;

        const t = smoothStep(
            this.elapsed /
            this.duration
        );

        this.value = lerp(
            this.startValue,
            this.targetValue,
            t
        );

        if (
            this.elapsed >=
            this.duration
        ) {

            this.value =
                this.targetValue;

            this.active = false;
        }

        return this.value;
    }
}


// ============================================================
// Rolling Average
// ============================================================

/**
 * 用于 FPS、Ping、BOT 性能统计等。
 */
export class RollingAverage {

    constructor(size = 30) {

        this.size =
            Math.max(
                1,
                size
            );

        this.values = [];
    }

    push(value) {

        this.values.push(value);

        if (
            this.values.length >
            this.size
        ) {
            this.values.shift();
        }
    }

    get average() {

        if (
            this.values.length === 0
        ) {
            return 0;
        }

        let total = 0;

        for (
            const value
            of this.values
        ) {
            total += value;
        }

        return (
            total /
            this.values.length
        );
    }

    clear() {
        this.values.length = 0;
    }
}


// ============================================================
// State Machine
// ============================================================

/**
 * 轻量状态机。
 *
 * BOT AI 后面会使用。
 */
export class StateMachine {

    constructor(initialState = null) {

        this.state =
            initialState;

        this.previousState =
            null;

        this.stateTime = 0;
    }

    /**
     * 修改状态
     */
    setState(newState) {

        if (
            this.state ===
            newState
        ) {
            return false;
        }

        this.previousState =
            this.state;

        this.state =
            newState;

        this.stateTime = 0;

        return true;
    }

    /**
     * 每帧更新状态持续时间
     */
    update(delta) {

        this.stateTime += delta;
    }

    /**
     * 是否当前状态
     */
    is(state) {

        return (
            this.state ===
            state
        );
    }

    /**
     * 当前状态持续多久
     */
    get duration() {

        return this.stateTime;
    }
}


// ============================================================
// Debug
// ============================================================

/**
 * Debug Logger
 */
export class DebugLogger {

    constructor(enabled = false) {

        this.enabled =
            enabled;
    }

    setEnabled(enabled) {

        this.enabled =
            Boolean(enabled);
    }

    log(...args) {

        if (!this.enabled) return;

        console.log(
            "[Web-CS15]",
            ...args
        );
    }

    warn(...args) {

        if (!this.enabled) return;

        console.warn(
            "[Web-CS15]",
            ...args
        );
    }

    error(...args) {

        console.error(
            "[Web-CS15]",
            ...args
        );
    }
}


// ============================================================
// 默认导出
// ============================================================

export default {

    clamp,

    clamp01,

    lerp,

    inverseLerp,

    remap,

    smoothStep,

    smootherStep,

    degToRad,

    radToDeg,

    normalizeAngleDegrees,

    normalizeAngleRadians,

    deltaAngleDegrees,

    lerpAngleDegrees,

    distanceSquared2D,

    distance2D,

    distanceSquared3D,

    distance3D,

    approximately,

    randomRange,

    randomInt,

    randomBool,

    chance,

    randomItem,

    randomItemWithIndex,

    shuffleArray,

    weightedRandom,

    now,

    secondsToMs,

    msToSeconds,

    sleep,

    Cooldown,

    RandomCooldown,

    GameTimer,

    EventEmitter,

    gameEvents,

    nextID,

    resetIDs,

    removeFromArray,

    last,

    hasItems,

    popRandom,

    getNested,

    padNumber,

    formatTime,

    capitalize,

    ValueTween,

    RollingAverage,

    StateMachine,

    DebugLogger
};
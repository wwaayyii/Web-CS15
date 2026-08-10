/**
 * Web-CS15
 * src/systems/audio.js
 *
 * 音频系统：
 * - Web Audio 初始化
 * - 枪声
 * - 爆炸声
 * - 脚步声
 * - 命中提示
 * - 玩家受伤音
 * - Radio Beep
 * - Radio TTS 英文语音
 * - 回合播报
 *
 * 不依赖 Three.js。
 */

import {
    AUDIO_CONFIG,
    RADIO_CONFIG,
    ANNOUNCER_CONFIG
} from "../core/config.js";

import {
    clamp,
    randomRange,
    gameEvents
} from "../core/utils.js";


// ============================================================
// AudioSystem
// ============================================================

export class AudioSystem {

    constructor() {

        this.context = null;

        this.masterGain = null;

        this.initialized = false;

        this.radioVoice = null;

        this.speechEnabled =
            RADIO_CONFIG.useTextToSpeech;

        this.masterVolume =
            AUDIO_CONFIG.masterVolume;

        this.weaponVolume =
            AUDIO_CONFIG.weaponVolume;

        this.footstepVolume =
            AUDIO_CONFIG.footstepVolume;

        this.explosionVolume =
            AUDIO_CONFIG.explosionVolume;

        this.radioVolume =
            AUDIO_CONFIG.radioVolume;

        this.uiVolume =
            AUDIO_CONFIG.uiVolume;

        this._bindSpeechEvents();
    }


    // ========================================================
    // 初始化
    // ========================================================

    init() {

        if (this.initialized) {
            return true;
        }

        const AudioContextClass =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioContextClass) {

            console.warn(
                "[AudioSystem] Web Audio API is not supported."
            );

            return false;
        }

        this.context =
            new AudioContextClass();

        this.masterGain =
            this.context.createGain();

        this.masterGain.gain.value =
            this.masterVolume;

        this.masterGain.connect(
            this.context.destination
        );

        this.initialized = true;

        this.selectRadioVoice();

        return true;
    }


    async resume() {

        if (!this.initialized) {

            const ok = this.init();

            if (!ok) {
                return false;
            }
        }

        if (
            this.context &&
            this.context.state === "suspended"
        ) {

            try {

                await this.context.resume();

            } catch (error) {

                console.warn(
                    "[AudioSystem] Failed to resume audio.",
                    error
                );
            }
        }

        return (
            this.context?.state === "running"
        );
    }


    // ========================================================
    // 总音量
    // ========================================================

    setMasterVolume(value) {

        this.masterVolume =
            clamp(value, 0, 1);

        if (
            this.masterGain
        ) {
            this.masterGain.gain.value =
                this.masterVolume;
        }
    }


    setWeaponVolume(value) {

        this.weaponVolume =
            clamp(value, 0, 1);
    }


    setFootstepVolume(value) {

        this.footstepVolume =
            clamp(value, 0, 1);
    }


    setExplosionVolume(value) {

        this.explosionVolume =
            clamp(value, 0, 1);
    }


    setRadioVolume(value) {

        this.radioVolume =
            clamp(value, 0, 1);
    }


    // ========================================================
    // 基础节点
    // ========================================================

    _createGain(value = 1) {

        if (!this.context) {
            return null;
        }

        const gain =
            this.context.createGain();

        gain.gain.value = value;

        gain.connect(
            this.masterGain
        );

        return gain;
    }


    _createNoiseBuffer(duration = 0.1) {

        if (!this.context) {
            return null;
        }

        const sampleRate =
            this.context.sampleRate;

        const length =
            Math.max(
                1,
                Math.floor(
                    sampleRate *
                    duration
                )
            );

        const buffer =
            this.context.createBuffer(
                1,
                length,
                sampleRate
            );

        const data =
            buffer.getChannelData(0);

        for (
            let i = 0;
            i < length;
            i++
        ) {

            data[i] =
                Math.random() * 2 - 1;
        }

        return buffer;
    }


    // ========================================================
    // 枪声
    // ========================================================

    playGunshot(type = "deagle") {

        if (!this.initialized) {
            return;
        }

        const ctx =
            this.context;

        const now =
            ctx.currentTime;

        let duration = 0.16;

        let startFrequency = 3500;

        let gainAmount =
            0.4 *
            this.weaponVolume;

        switch (type) {

            case "awp":

                duration = 0.42;

                startFrequency = 6000;

                gainAmount =
                    0.8 *
                    this.weaponVolume;

                break;


            case "ak47":

                duration = 0.18;

                startFrequency = 4200;

                gainAmount =
                    0.55 *
                    this.weaponVolume;

                break;


            case "m4a1":

                duration = 0.15;

                startFrequency = 3800;

                gainAmount =
                    0.48 *
                    this.weaponVolume;

                break;


            case "mp5":

                duration = 0.11;

                startFrequency = 3200;

                gainAmount =
                    0.32 *
                    this.weaponVolume;

                break;


            case "usp":

            case "glock":

                duration = 0.12;

                startFrequency = 2900;

                gainAmount =
                    0.30 *
                    this.weaponVolume;

                break;


            case "deagle":

            default:

                duration = 0.25;

                startFrequency = 3500;

                gainAmount =
                    0.45 *
                    this.weaponVolume;

                break;
        }


        const buffer =
            this._createNoiseBuffer(
                duration
            );

        if (!buffer) {
            return;
        }


        const noise =
            ctx.createBufferSource();

        noise.buffer = buffer;


        const filter =
            ctx.createBiquadFilter();

        filter.type = "lowpass";

        filter.frequency.setValueAtTime(
            startFrequency,
            now
        );

        filter.frequency.exponentialRampToValueAtTime(
            60,
            now + duration
        );


        const gain =
            ctx.createGain();

        gain.gain.setValueAtTime(
            Math.max(
                0.001,
                gainAmount
            ),
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + duration
        );


        noise.connect(filter);

        filter.connect(gain);

        gain.connect(
            this.masterGain
        );

        noise.start(now);
    }


    // ========================================================
    // 爆炸
    // ========================================================

    playExplosion() {

        if (!this.initialized) {
            return;
        }

        const ctx =
            this.context;

        const now =
            ctx.currentTime;

        const duration =
            0.8;

        const buffer =
            this._createNoiseBuffer(
                duration
            );

        if (!buffer) {
            return;
        }


        const noise =
            ctx.createBufferSource();

        noise.buffer = buffer;


        const filter =
            ctx.createBiquadFilter();

        filter.type =
            "lowpass";

        filter.frequency.setValueAtTime(
            1100,
            now
        );

        filter.frequency.exponentialRampToValueAtTime(
            30,
            now + duration
        );


        const gain =
            ctx.createGain();

        gain.gain.setValueAtTime(
            Math.max(
                0.001,
                this.explosionVolume
            ),
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + duration
        );


        noise.connect(filter);

        filter.connect(gain);

        gain.connect(
            this.masterGain
        );

        noise.start(now);
    }


    // ========================================================
    // 玩家脚步
    // ========================================================

    playFootstep({
        sprinting = false,
        crouching = false
    } = {}) {

        if (!this.initialized) {
            return;
        }

        const ctx =
            this.context;

        const now =
            ctx.currentTime;

        const duration =
            crouching
                ? 0.065
                : 0.08;

        const buffer =
            this._createNoiseBuffer(
                duration
            );

        if (!buffer) {
            return;
        }


        const noise =
            ctx.createBufferSource();

        noise.buffer = buffer;


        const filter =
            ctx.createBiquadFilter();

        filter.type =
            "bandpass";

        let frequency = 500;

        let volume =
            0.12 *
            this.footstepVolume;


        if (sprinting) {

            frequency = 800;

            volume =
                0.25 *
                this.footstepVolume;
        }


        if (crouching) {

            frequency = 350;

            volume =
                0.055 *
                this.footstepVolume;
        }


        filter.frequency.setValueAtTime(
            frequency,
            now
        );

        filter.Q.setValueAtTime(
            1.5,
            now
        );


        const gain =
            ctx.createGain();

        gain.gain.setValueAtTime(
            Math.max(
                0.001,
                volume
            ),
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + duration
        );


        noise.connect(filter);

        filter.connect(gain);

        gain.connect(
            this.masterGain
        );

        noise.start(now);
    }


    // ========================================================
    // BOT 脚步
    //
    // distance 由 bot.js / botAI.js 计算后传入。
    // ========================================================

    playBotFootstep(
        distance,
        maxDistance =
            AUDIO_CONFIG.maxBotFootstepDistance
    ) {

        if (!this.initialized) {
            return;
        }

        if (
            distance >
            maxDistance
        ) {
            return;
        }


        const ctx =
            this.context;

        const now =
            ctx.currentTime;

        const duration =
            0.09;

        const distanceFactor =
            clamp(
                1 -
                distance /
                maxDistance,
                0,
                1
            );


        const buffer =
            this._createNoiseBuffer(
                duration
            );

        if (!buffer) {
            return;
        }


        const noise =
            ctx.createBufferSource();

        noise.buffer = buffer;


        const filter =
            ctx.createBiquadFilter();

        filter.type =
            "lowpass";

        filter.frequency.setValueAtTime(
            450,
            now
        );


        const gain =
            ctx.createGain();

        gain.gain.setValueAtTime(
            Math.max(
                0.001,
                distanceFactor *
                0.3 *
                this.footstepVolume
            ),
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + duration
        );


        noise.connect(filter);

        filter.connect(gain);

        gain.connect(
            this.masterGain
        );

        noise.start(now);
    }


    // ========================================================
    // Hitmarker
    // ========================================================

    playHit({
        kill = false
    } = {}) {

        if (!this.initialized) {
            return;
        }


        const ctx =
            this.context;

        const now =
            ctx.currentTime;


        const oscillator =
            ctx.createOscillator();

        const gain =
            ctx.createGain();


        oscillator.type =
            "sine";


        const frequency =
            kill
                ? 1200
                : 800;


        oscillator.frequency.setValueAtTime(
            frequency,
            now
        );

        oscillator.frequency.exponentialRampToValueAtTime(
            frequency / 2,
            now + 0.08
        );


        gain.gain.setValueAtTime(
            (
                kill
                    ? 0.4
                    : 0.25
            ) *
            this.uiVolume,
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + 0.08
        );


        oscillator.connect(gain);

        gain.connect(
            this.masterGain
        );


        oscillator.start(now);

        oscillator.stop(
            now + 0.08
        );
    }


    // ========================================================
    // 玩家受伤
    // ========================================================

    playPlayerDamage() {

        if (!this.initialized) {
            return;
        }


        const ctx =
            this.context;

        const now =
            ctx.currentTime;


        const oscillator =
            ctx.createOscillator();

        const gain =
            ctx.createGain();


        oscillator.type =
            "sawtooth";


        oscillator.frequency.setValueAtTime(
            120,
            now
        );

        oscillator.frequency.exponentialRampToValueAtTime(
            40,
            now + 0.15
        );


        gain.gain.setValueAtTime(
            0.3 *
            this.uiVolume,
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + 0.15
        );


        oscillator.connect(gain);

        gain.connect(
            this.masterGain
        );


        oscillator.start(now);

        oscillator.stop(
            now + 0.15
        );
    }


    // ========================================================
    // 空枪声
    // ========================================================

    playEmptyClick() {

        if (!this.initialized) {
            return;
        }


        const ctx =
            this.context;

        const now =
            ctx.currentTime;


        const oscillator =
            ctx.createOscillator();

        const gain =
            ctx.createGain();


        oscillator.type =
            "square";


        oscillator.frequency.setValueAtTime(
            1000,
            now
        );


        gain.gain.setValueAtTime(
            0.05 *
            this.weaponVolume,
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + 0.025
        );


        oscillator.connect(gain);

        gain.connect(
            this.masterGain
        );


        oscillator.start(now);

        oscillator.stop(
            now + 0.03
        );
    }


    // ========================================================
    // Reload 声音
    // ========================================================

    playReload() {

        /*
         * Reload Sound V2:
         * 实际机械声由 weapon:reload-stage 驱动。
         * 这里保留为兼容入口，但不再一次性播放整套声音。
         */
        this.playReloadStage(
            "start"
        );
    }


    playReloadStage(
        stage = "start",
        weaponId = "default"
    ) {

        if (
            !this.initialized ||
            !this.context ||
            !this.masterGain
        ) {
            return;
        }


        const ctx =
            this.context;

        const now =
            ctx.currentTime;


        // ====================================================
        // Reload Sound V3
        //
        // Web Audio procedural mechanical sound.
        // No external WAV / MP3 required.
        // ====================================================

        let lowFrequency =
            420;

        let highFrequency =
            1150;

        let duration =
            0.075;

        let volume =
            0.13 *
            this.weaponVolume;

        let noiseVolume =
            0.075 *
            this.weaponVolume;

        let noiseFrequency =
            1500;


        switch (
            stage
        ) {

            // magazine catch / release button
            case "mag-release":

                lowFrequency =
                    520;

                highFrequency =
                    1450;

                duration =
                    0.055;

                volume =
                    0.12 *
                    this.weaponVolume;

                noiseVolume =
                    0.060 *
                    this.weaponVolume;

                noiseFrequency =
                    1900;

                break;


            // old magazine sliding / leaving weapon
            case "mag-out":

                lowFrequency =
                    260;

                highFrequency =
                    760;

                duration =
                    0.105;

                volume =
                    0.135 *
                    this.weaponVolume;

                noiseVolume =
                    0.095 *
                    this.weaponVolume;

                noiseFrequency =
                    900;

                break;


            // new magazine locks into magwell
            case "mag-in":

                lowFrequency =
                    340;

                highFrequency =
                    1200;

                duration =
                    0.095;

                volume =
                    0.17 *
                    this.weaponVolume;

                noiseVolume =
                    0.10 *
                    this.weaponVolume;

                noiseFrequency =
                    1350;

                break;


            // slide / bolt / action completion
            case "action":

                lowFrequency =
                    230;

                highFrequency =
                    1550;

                duration =
                    0.12;

                volume =
                    0.18 *
                    this.weaponVolume;

                noiseVolume =
                    0.115 *
                    this.weaponVolume;

                noiseFrequency =
                    1800;

                break;


            case "start":
            default:

                lowFrequency =
                    400;

                highFrequency =
                    900;

                duration =
                    0.045;

                volume =
                    0.07 *
                    this.weaponVolume;

                noiseVolume =
                    0.035 *
                    this.weaponVolume;

                noiseFrequency =
                    1100;

                break;
        }


        // ----------------------------------------------------
        // Weapon family tuning
        // ----------------------------------------------------

        const isPistol =
            (
                weaponId ===
                    "usp" ||
                weaponId ===
                    "glock" ||
                weaponId ===
                    "deagle"
            );


        const isRifle =
            (
                weaponId ===
                    "ak47" ||
                weaponId ===
                    "m4a1"
            );


        const isSniper =
            (
                weaponId ===
                    "awp" ||
                weaponId ===
                    "scout"
            );


        if (
            isPistol
        ) {

            highFrequency *=
                1.12;

            duration *=
                0.90;
        }


        if (
            isRifle
        ) {

            lowFrequency *=
                0.90;

            volume *=
                1.05;

            noiseVolume *=
                1.08;
        }


        if (
            isSniper
        ) {

            lowFrequency *=
                0.72;

            highFrequency *=
                0.78;

            duration *=
                1.22;

            volume *=
                1.16;
        }


        // ====================================================
        // Layer 1: metal click / clack
        // ====================================================

        const metal =
            ctx.createOscillator();


        const metalGain =
            ctx.createGain();


        const metalFilter =
            ctx.createBiquadFilter();


        /*
         * triangle 比 square 少电子蜂鸣感，
         * 但仍有明显机械撞击的谐波。
         */
        metal.type =
            "triangle";


        metal.frequency.setValueAtTime(
            Math.max(
                90,
                highFrequency
            ),
            now
        );


        metal.frequency.exponentialRampToValueAtTime(
            Math.max(
                80,
                lowFrequency
            ),
            now + duration
        );


        metalFilter.type =
            "bandpass";


        metalFilter.frequency.setValueAtTime(
            Math.max(
                350,
                highFrequency *
                0.82
            ),
            now
        );


        metalFilter.Q.setValueAtTime(
            1.6,
            now
        );


        metalGain.gain.setValueAtTime(
            Math.max(
                0.001,
                volume
            ),
            now
        );


        metalGain.gain.exponentialRampToValueAtTime(
            0.001,
            now + duration
        );


        metal.connect(
            metalFilter
        );


        metalFilter.connect(
            metalGain
        );


        metalGain.connect(
            this.masterGain
        );


        metal.start(
            now
        );


        metal.stop(
            now +
            duration +
            0.01
        );


        // ====================================================
        // Layer 2: mechanical friction / magazine body
        // ====================================================

        const noiseBuffer =
            this._createNoiseBuffer(
                duration *
                1.15
            );


        if (
            noiseBuffer
        ) {

            const noise =
                ctx.createBufferSource();


            const noiseFilter =
                ctx.createBiquadFilter();


            const noiseGain =
                ctx.createGain();


            noise.buffer =
                noiseBuffer;


            noiseFilter.type =
                "bandpass";


            noiseFilter.frequency.setValueAtTime(
                noiseFrequency,
                now
            );


            noiseFilter.frequency.exponentialRampToValueAtTime(
                Math.max(
                    180,
                    noiseFrequency *
                    0.38
                ),
                now +
                duration
            );


            noiseFilter.Q.setValueAtTime(
                0.85,
                now
            );


            noiseGain.gain.setValueAtTime(
                Math.max(
                    0.001,
                    noiseVolume
                ),
                now
            );


            noiseGain.gain.exponentialRampToValueAtTime(
                0.001,
                now +
                duration *
                1.10
            );


            noise.connect(
                noiseFilter
            );


            noiseFilter.connect(
                noiseGain
            );


            noiseGain.connect(
                this.masterGain
            );


            noise.start(
                now
            );
        }


        // ====================================================
        // Layer 3: extra lock impact for mag-in / action
        // ====================================================

        if (
            stage ===
                "mag-in" ||
            stage ===
                "action"
        ) {

            const lock =
                ctx.createOscillator();


            const lockGain =
                ctx.createGain();


            lock.type =
                "square";


            const lockStart =
                now +
                duration *
                0.18;


            const lockFrequency =
                stage ===
                    "action"
                    ? 390
                    : 520;


            lock.frequency.setValueAtTime(
                lockFrequency,
                lockStart
            );


            lock.frequency.exponentialRampToValueAtTime(
                120,
                lockStart +
                0.045
            );


            lockGain.gain.setValueAtTime(
                0.065 *
                this.weaponVolume,
                lockStart
            );


            lockGain.gain.exponentialRampToValueAtTime(
                0.001,
                lockStart +
                0.050
            );


            lock.connect(
                lockGain
            );


            lockGain.connect(
                this.masterGain
            );


            lock.start(
                lockStart
            );


            lock.stop(
                lockStart +
                0.055
            );
        }
    }


    // ========================================================
    // Radio Beep
    // ========================================================

    playRadioBeep() {

        if (!this.initialized) {
            return;
        }


        const ctx =
            this.context;

        const now =
            ctx.currentTime;


        const oscillator =
            ctx.createOscillator();

        const gain =
            ctx.createGain();


        oscillator.type =
            "square";


        oscillator.frequency.setValueAtTime(
            AUDIO_CONFIG.radio.beepFrequency,
            now
        );


        gain.gain.setValueAtTime(
            0.08 *
            this.radioVolume,
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now +
            AUDIO_CONFIG.radio.beepDuration
        );


        oscillator.connect(gain);

        gain.connect(
            this.masterGain
        );


        oscillator.start(now);

        oscillator.stop(
            now +
            AUDIO_CONFIG.radio.beepDuration
        );
    }


    // ========================================================
    // Radio End Beep
    // ========================================================

    playRadioEndBeep() {

        if (!this.initialized) {
            return;
        }


        const ctx =
            this.context;

        const now =
            ctx.currentTime;


        const oscillator =
            ctx.createOscillator();

        const gain =
            ctx.createGain();


        oscillator.type =
            "square";


        oscillator.frequency.setValueAtTime(
            AUDIO_CONFIG.radio.endBeepFrequency,
            now
        );


        gain.gain.setValueAtTime(
            0.055 *
            this.radioVolume,
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now +
            AUDIO_CONFIG.radio.endBeepDuration
        );


        oscillator.connect(gain);

        gain.connect(
            this.masterGain
        );


        oscillator.start(now);

        oscillator.stop(
            now +
            AUDIO_CONFIG.radio.endBeepDuration
        );
    }


    // ========================================================
    // Radio Voice
    // ========================================================

    _bindSpeechEvents() {

        if (
            !(
                "speechSynthesis"
                in window
            )
        ) {
            return;
        }


        window
            .speechSynthesis
            .onvoiceschanged =
            () => {

                this.selectRadioVoice();
            };
    }


    selectRadioVoice() {

        if (
            !(
                "speechSynthesis"
                in window
            )
        ) {
            return null;
        }


        const voices =
            window
                .speechSynthesis
                .getVoices();


        this.radioVoice =
            voices.find(
                voice =>
                    /^en-US$/i.test(
                        voice.lang
                    ) &&
                    /male|david|mark|daniel|guy/i.test(
                        voice.name
                    )
            )

            ||

            voices.find(
                voice =>
                    /^en-(US|GB)/i.test(
                        voice.lang
                    )
            )

            ||

            voices.find(
                voice =>
                    /^en/i.test(
                        voice.lang
                    )
            )

            ||

            voices[0]

            ||

            null;


        return this.radioVoice;
    }


    setSpeechEnabled(enabled) {

        this.speechEnabled =
            Boolean(enabled);

        if (
            !this.speechEnabled &&
            "speechSynthesis" in window
        ) {

            window
                .speechSynthesis
                .cancel();
        }
    }


    stopSpeech() {

        if (
            "speechSynthesis"
            in window
        ) {

            window
                .speechSynthesis
                .cancel();
        }
    }


    speakRadio(
        text,
        {
            cancelPrevious = true,
            playStartBeep = true,
            playEndBeep = true
        } = {}
    ) {

        if (!text) {
            return;
        }


        if (playStartBeep) {

            this.playRadioBeep();
        }


        if (
            !this.speechEnabled ||
            !(
                "speechSynthesis"
                in window
            ) ||
            typeof SpeechSynthesisUtterance ===
                "undefined"
        ) {

            if (playEndBeep) {

                window.setTimeout(
                    () => {

                        this.playRadioEndBeep();

                    },
                    250
                );
            }

            return;
        }


        if (cancelPrevious) {

            window
                .speechSynthesis
                .cancel();
        }


        if (!this.radioVoice) {

            this.selectRadioVoice();
        }


        const utterance =
            new SpeechSynthesisUtterance(
                text
            );


        utterance.lang =
            this.radioVoice?.lang ||
            RADIO_CONFIG.voice.language;


        if (this.radioVoice) {

            utterance.voice =
                this.radioVoice;
        }


        utterance.rate =
            RADIO_CONFIG.voice.rate;


        utterance.pitch =
            RADIO_CONFIG.voice.pitch;


        utterance.volume =
            clamp(
                RADIO_CONFIG.voice.volume *
                this.radioVolume,
                0,
                1
            );


        if (playEndBeep) {

            utterance.onend =
                () => {

                    this.playRadioEndBeep();
                };


            utterance.onerror =
                () => {

                    this.playRadioEndBeep();
                };
        }


        window
            .speechSynthesis
            .speak(
                utterance
            );
    }


    // ========================================================
    // 系统播报
    // ========================================================

    announceRoundResult(result) {

        let phrase = null;


        switch (result) {

            case "ct":

            case "CT":

            case "CT_WIN":

                phrase =
                    ANNOUNCER_CONFIG.CT_WIN;

                break;


            case "t":

            case "T":

            case "T_WIN":

                phrase =
                    ANNOUNCER_CONFIG.T_WIN;

                break;


            case "draw":

            case "DRAW":

                phrase =
                    ANNOUNCER_CONFIG.DRAW;

                break;


            default:

                phrase =
                    String(result || "");
        }


        if (!phrase) {
            return;
        }


        this.speakRadio(
            phrase,
            {
                playStartBeep: false,
                playEndBeep: false
            }
        );
    }


    announceRoundStart() {

        this.speakRadio(
            ANNOUNCER_CONFIG.ROUND_START,
            {
                playStartBeep: false,
                playEndBeep: false
            }
        );
    }


    // ========================================================
    // UI Click
    // ========================================================

    playUIClick() {

        if (!this.initialized) {
            return;
        }


        const ctx =
            this.context;

        const now =
            ctx.currentTime;


        const oscillator =
            ctx.createOscillator();

        const gain =
            ctx.createGain();


        oscillator.type =
            "square";


        oscillator.frequency.setValueAtTime(
            700,
            now
        );


        gain.gain.setValueAtTime(
            0.025 *
            this.uiVolume,
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + 0.03
        );


        oscillator.connect(gain);

        gain.connect(
            this.masterGain
        );


        oscillator.start(now);

        oscillator.stop(
            now + 0.035
        );
    }


    // ========================================================
    // 购买武器 / 装备成功音效
    //
    // 使用 Web Audio API 动态合成，不需要 MP3/WAV。
    // ========================================================

    playPurchaseWeapon() {

        if (!this.initialized) {
            return;
        }

        const ctx = this.context;
        const now = ctx.currentTime;

        // 两段短促金属机械声
        const notes = [
            { time: 0.00, frequency: 520, volume: 0.055, duration: 0.045 },
            { time: 0.055, frequency: 880, volume: 0.045, duration: 0.055 }
        ];

        for (const note of notes) {

            const oscillator =
                ctx.createOscillator();

            const gain =
                ctx.createGain();

            oscillator.type =
                "square";

            const start =
                now + note.time;

            oscillator.frequency.setValueAtTime(
                note.frequency,
                start
            );

            oscillator.frequency.exponentialRampToValueAtTime(
                Math.max(
                    80,
                    note.frequency * 0.72
                ),
                start + note.duration
            );

            gain.gain.setValueAtTime(
                Math.max(
                    0.001,
                    note.volume *
                    this.uiVolume
                ),
                start
            );

            gain.gain.exponentialRampToValueAtTime(
                0.001,
                start + note.duration
            );

            oscillator.connect(
                gain
            );

            gain.connect(
                this.masterGain
            );

            oscillator.start(
                start
            );

            oscillator.stop(
                start + note.duration
            );
        }
    }


    // ========================================================
    // 购买子弹成功音效
    //
    // secondary = 手枪弹药，声音稍轻
    // primary   = 主武器弹药，声音稍重
    // ========================================================

    playPurchaseAmmo(
        type = "primary"
    ) {

        if (!this.initialized) {
            return;
        }

        const ctx =
            this.context;

        const now =
            ctx.currentTime;

        const isSecondary =
            type === "secondary";

        const baseFrequency =
            isSecondary
                ? 1050
                : 820;

        const baseVolume =
            (
                isSecondary
                    ? 0.035
                    : 0.045
            ) *
            this.uiVolume;

        // 两颗“子弹/弹匣卡入”的短促机械声
        for (
            let i = 0;
            i < 2;
            i++
        ) {

            const oscillator =
                ctx.createOscillator();

            const gain =
                ctx.createGain();

            const start =
                now +
                i * 0.065;

            oscillator.type =
                "square";

            oscillator.frequency.setValueAtTime(
                baseFrequency +
                i * 160,
                start
            );

            oscillator.frequency.exponentialRampToValueAtTime(
                Math.max(
                    120,
                    baseFrequency * 0.58
                ),
                start + 0.038
            );

            gain.gain.setValueAtTime(
                Math.max(
                    0.001,
                    baseVolume
                ),
                start
            );

            gain.gain.exponentialRampToValueAtTime(
                0.001,
                start + 0.04
            );

            oscillator.connect(
                gain
            );

            gain.connect(
                this.masterGain
            );

            oscillator.start(
                start
            );

            oscillator.stop(
                start + 0.045
            );
        }
    }


    // ========================================================
    // 购买失败音效
    // ========================================================

    playPurchaseFailed() {

        if (!this.initialized) {
            return;
        }

        const ctx =
            this.context;

        const now =
            ctx.currentTime;

        const oscillator =
            ctx.createOscillator();

        const gain =
            ctx.createGain();

        oscillator.type =
            "square";

        oscillator.frequency.setValueAtTime(
            190,
            now
        );

        oscillator.frequency.exponentialRampToValueAtTime(
            115,
            now + 0.11
        );

        gain.gain.setValueAtTime(
            Math.max(
                0.001,
                0.04 *
                this.uiVolume
            ),
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + 0.12
        );

        oscillator.connect(
            gain
        );

        gain.connect(
            this.masterGain
        );

        oscillator.start(
            now
        );

        oscillator.stop(
            now + 0.125
        );
    }


    // ========================================================
    // 随机机械声
    // ========================================================

    playMechanicalClick() {

        if (!this.initialized) {
            return;
        }


        const ctx =
            this.context;

        const now =
            ctx.currentTime;


        const oscillator =
            ctx.createOscillator();

        const gain =
            ctx.createGain();


        oscillator.type =
            "square";


        oscillator.frequency.setValueAtTime(
            randomRange(
                500,
                1100
            ),
            now
        );


        gain.gain.setValueAtTime(
            0.03 *
            this.weaponVolume,
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + 0.025
        );


        oscillator.connect(gain);

        gain.connect(
            this.masterGain
        );


        oscillator.start(now);

        oscillator.stop(
            now + 0.03
        );
    }


    // ========================================================
    // Destroy
    // ========================================================

    destroy() {

        this.stopSpeech();


        if (this.context) {

            try {

                this.context.close();

            } catch (_) {
                // ignore
            }
        }


        this.context = null;

        this.masterGain = null;

        this.initialized = false;
    }
}


// ============================================================
// 单例
// ============================================================

export const audio =
    new AudioSystem();


// ============================================================
// Game Event 自动绑定
//
// 后面其他模块只 emit 事件，
// audio.js 自己负责声音。
// ============================================================

// ============================================================
// Economy / Buy 音效
//
// economy.js 只有购买真正成功后才会 emit economy:purchase，
// 因此不会出现“钱不够却播放成功音效”的情况。
// ============================================================

gameEvents.on(
    "economy:purchase",
    (data = {}) => {

        switch (
            data.itemId
        ) {

            case "primary_ammo":

                audio.playPurchaseAmmo(
                    "primary"
                );

                break;


            case "secondary_ammo":

                audio.playPurchaseAmmo(
                    "secondary"
                );

                break;


            default:

                /*
                 * 武器、护甲、手雷等统一使用
                 * 机械式购买确认音。
                 */
                audio.playPurchaseWeapon();

                break;
        }
    }
);


gameEvents.on(
    "economy:purchase-failed",
    () => {

        audio.playPurchaseFailed();
    }
);


gameEvents.on(
    "weapon:fire",
    (data = {}) => {

        audio.playGunshot(
            data.weaponId ||
            data.weapon ||
            "deagle"
        );
    }
);


/*
 * Reload Sound V2 的阶段事件由 game.js / Game.bindAudioEvents()
 * 统一转发给 audio.playReloadStage()。
 */


gameEvents.on(
    "weapon:empty",
    () => {

        audio.playEmptyClick();
    }
);


gameEvents.on(
    "grenade:explode",
    () => {

        audio.playExplosion();
    }
);


gameEvents.on(
    "player:damage",
    () => {

        audio.playPlayerDamage();
    }
);


gameEvents.on(
    "radio:voice",
    (data = {}) => {

        if (!data.text) {
            return;
        }


        audio.speakRadio(
            data.text,
            {
                cancelPrevious:
                    data.cancelPrevious ??
                    true,

                playStartBeep:
                    data.playStartBeep ??
                    true,

                playEndBeep:
                    data.playEndBeep ??
                    true
            }
        );
    }
);


gameEvents.on(
    "round:end",
    (data = {}) => {

        if (!data.winner) {
            return;
        }


        audio.announceRoundResult(
            data.winner
        );
    }
);


gameEvents.on(
    "round:start",
    () => {

        audio.announceRoundStart();
    }
);


// ============================================================
// 默认导出
// ============================================================

export default audio;
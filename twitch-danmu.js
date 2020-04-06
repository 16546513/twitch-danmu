// ==UserScript==
// @name         twitch弹幕助手
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  提供twitch弹幕支持
// @author       xxx
// @match        https://www.twitch.tv/*
// ==/UserScript==

;(function() {
  let DEV = true

  class Css {
    static set(name, value) {
      if (!Css.css) {
        Css.css = []
      }
      Css.css.push(`${name}:${value}`)
      return Css
    }
    static clean() {
      Css.css.length = 0
      return Css
    }
    static get() {
      let str = Css.css.join(';')
      Css.clean()
      return str
    }
  }

  class Dom {
    constructor(tag) {
      this.dom = document.createElement(tag)
    }
    set(name, value) {
      Css.set(name, value)
      return this
    }
    get() {
      this.dom.style = Css.get()
      return this.dom
    }
  }

  class Danmu {
    constructor(msg) {
      this.name = msg.name
      this.text = msg.text
      this.create()
      Danmu.append(this)
    }
    create() {
      this.left = Danmu.opts.areaWidth
      this.dom = new Dom('span')
        .set('font-size', Danmu.opts.danmu.size)
        .set('color', Danmu.opts.danmu.color)
        .set('position', Danmu.opts.danmu.position)
        .set('transform', `translateX(${this.left}px)`)
        .set('transition', 'transform')
        .get()
      this.dom.innerText = this.text
    }
    static append(danmu) {
      Danmu.danmus.push(danmu)
      if (DEV) {
        // console.log(danmu)
      }
      if (Danmu.area) {
        Danmu.area.appendChild(danmu.dom)
        if (!Danmu.isStop && !Danmu.running) {
          Danmu.run()
        }
      }
    }
    static stop() {
      Danmu.running = false
      Danmu.isStop = true
      cancelAnimationFrame(Danmu.timer)
    }
    static run() {
      Danmu.running = true
      let _run = () => {
        cancelAnimationFrame(Danmu.timer)
        Danmu.timer = requestAnimationFrame(() => {
          Danmu.render()
          _run()
        })
      }
      _run()
    }
    static render() {
      Danmu.danmus.forEach(danmu => {
        danmu.render()
      })
    }
    render() {
      this.update()
      this.draw()
    }
    draw() {
      this.dom.style.transform = `translateX(${this.left}px)`
    }
    update() {
      this.left -= Danmu.opts.danmu.speed
      if (this.left < -this.dom.clientWidth) {
        Danmu.clean(this)
      }
    }
    static clean(danmu) {
      for (let i = 0; i < Danmu.danmus.length; i++) {
        if (danmu == Danmu.danmus[i]) {
          Danmu.area.removeChild(danmu.dom)
          return Danmu.danmus.splice(i, 1)
        }
      }
    }
    static find() {
      return new Promise((res, rej) => {
        let f = () => {
          let wrapper = document.querySelector(Danmu.opts.sel.area)
          if (!wrapper) {
            return setTimeout(f, 100)
          }
          res(wrapper)
        }
        f()
      })
    }
    static calcWidth() {
      Danmu.opts.areaWidth = Danmu.area.clientWidth
    }
    static mk(wrapper) {
      let area = new Dom('div')
        .set('position', 'absolute')
        .set('pointer-events', 'none')
        .set('inset', '0')
        .get()
      if (wrapper) {
        wrapper.appendChild(area)
        Danmu.area = area
        Danmu.calcWidth()
      }
    }
    static init() {
      Danmu.danmus = []
      Danmu.opts = {
        sel: {
          area: '.persistent-player'
        },
        danmu: {
          color: '#fff',
          size: '100%',
          speed: 3,
          position: 'absolute'
        },
        isStop: false,
        running: false
      }
      Danmu.find()
        .then(Danmu.mk)
        .catch(() => {})
    }
  }

  class Ob {
    static find() {
      return new Promise((res, rej) => {
        let f = () => {
          let wrapper = document.querySelector(Ob.opts.sel.list)
          if (!wrapper) {
            return setTimeout(f, 100)
          }
          res(wrapper)
        }
        f()
      })
    }
    static init() {
      Ob.opts = {
        sel: {
          list: '.chat-list__list-container'
        },
        obOpt: {
          childList: true
        }
      }
      Ob.find()
        .then(Ob.ob)
        .catch(() => {})
    }
    static ob(obed) {
      let observer = new MutationObserver(Ob.cb)
      observer.observe(obed, Ob.opts.obOpt)
      Ob.observer = observer
    }
    static disconnect() {
      Ob.observer.disconnect()
    }
    static cb(list) {
      list.forEach(({ addedNodes }) => {
        for (let node of addedNodes) {
          let msg = {}
          Parser.parse(node, msg)
          new Danmu(msg)
        }
      })
    }
  }

  class Parser {
    static valid(str) {
      return str != ''
    }
    static parse(message, danmu) {
      danmu.name = Parser.parseName(message)
      danmu.text = Parser.parseText(message)
      if (DEV) {
        // console.log(danmu.name, ':', danmu.text)
      }
    }
    static walk(message, sel, cb) {
      message.querySelectorAll(sel).forEach(cb)
    }
    static parseText(message) {
      let text = []
      let cb = node => {
        let fr = node.innerText.trim()
        if (Parser.valid(fr)) {
          text.push(fr)
        }
      }
      Parser.walk(message, Parser.opts.sel.mention, cb)
      Parser.walk(message, Parser.opts.sel.text, cb)
      return text.join(' ')
    }
    static parseName(message) {
      let dom = message.querySelector(Parser.opts.sel.name)
      return dom.innerText
    }
    static init() {
      Parser.opts = {
        sel: {
          name: '.chat-line__username .chat-author__display-name',
          text: '.text-fragment',
          mention: '.mention-fragment'
        }
      }
    }
  }

  Danmu.init()
  Ob.init()
  Parser.init()
})()

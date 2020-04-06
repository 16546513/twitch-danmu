// ==UserScript==
// @name         twitch弹幕助手
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  提供twitch弹幕支持
// @author       xxx
// @match        https://www.twitch.tv/*
// ==/UserScript==

;(function () {
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
    static ensureRow() {
      let row = Danmu.opts.rows
      Danmu.opts.rows = (row + 1) % Danmu.opts.totalRows
      if (!Danmu.danmus[row]) {
        Danmu.danmus[row] = []
      }
      return row
    }
    static ensureTop(row) {
      return row * Danmu.opts.danmu.size + Danmu.opts.danmu.rowGap
    }
    static ensureLeft(row) {
      if (Danmu.danmus[row].length == 0) {
        return Danmu.opts.areaWidth
      }
      let back = Danmu.danmus[row][Danmu.danmus[row].length - 1]
      if (back.left + back.dom.clientWidth < Danmu.opts.areaWidth) {
        return Danmu.opts.areaWidth
      }
      return back.left + back.dom.clientWidth + Danmu.opts.danmu.colGap
    }
    create() {
      this.row = Danmu.ensureRow()
      this.left = Danmu.ensureLeft(this.row)
      this.top = Danmu.ensureTop(this.row)
      this.dom = new Dom('span')
        .set('font-size', Danmu.opts.danmu.size + 'px')
        .set('color', Danmu.opts.danmu.color)
        .set('position', Danmu.opts.danmu.position)
        .set('top', this.top + 'px')
        .set('transform', `translateX(${this.left}px)`)
        // .set('transition', 'transform')
        .get()
      this.dom.innerText = this.text
    }
    static append(danmu) {
      Danmu.danmus[danmu.row].push(danmu)
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
      Danmu.danmus.forEach((danmus) => {
        danmus.forEach((danmu) => {
          danmu.render()
        })
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
      for (let i = 0; i < Danmu.danmus[danmu.row].length; i++) {
        if (danmu == Danmu.danmus[danmu.row][i]) {
          Danmu.area.removeChild(danmu.dom)
          return Danmu.danmus[danmu.row].splice(i, 1)
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
          area: '.persistent-player',
        },
        danmu: {
          color: '#fff',
          size: 16,
          speed: 3,
          position: 'absolute',
          rowGap: 5,
          colGap: 25,
        },
        rows: 0,
        totalRows: 5,
        isStop: false,
        running: false,
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
          list: '.chat-list__list-container',
        },
        obOpt: {
          childList: true,
        },
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
      let cb = (node) => {
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
          mention: '.mention-fragment',
        },
      }
    }
  }

  Danmu.init()
  Ob.init()
  Parser.init()
})()

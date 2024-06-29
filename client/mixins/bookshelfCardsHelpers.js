import Vue from 'vue'
import LazyBookCard from '@/components/cards/LazyBookCard'
import LazySeriesCard from '@/components/cards/LazySeriesCard'
import LazyCollectionCard from '@/components/cards/LazyCollectionCard'
import LazyPlaylistCard from '@/components/cards/LazyPlaylistCard'
import LazyAlbumCard from '@/components/cards/LazyAlbumCard'

export default {
  data() {
    return {
      cardsHelpers: {
        mountEntityCard: this.mountEntityCard
      }
    }
  },
  methods: {
    getComponentClass() {
      if (this.entityName === 'series') return Vue.extend(LazySeriesCard)
      if (this.entityName === 'collections') return Vue.extend(LazyCollectionCard)
      if (this.entityName === 'playlists') return Vue.extend(LazyPlaylistCard)
      if (this.entityName === 'albums') return Vue.extend(LazyAlbumCard)
      return Vue.extend(LazyBookCard)
    },
    async mountEntityCard(index) {
      var shelf = Math.floor(index / this.entitiesPerShelf)
      var shelfEl = document.getElementById(`shelf-${shelf}`)
      if (!shelfEl) {
        console.error('invalid shelf', shelf, 'book index', index)
        return
      }
      this.entityIndexesMounted.push(index)
      if (this.entityComponentRefs[index]) {
        const bookComponent = this.entityComponentRefs[index]
        shelfEl.appendChild(bookComponent.$el)
        if (this.isSelectionMode) {
          bookComponent.setSelectionMode(true)
          if (this.selectedMediaItems.some(i => i.id === bookComponent.libraryItemId) || this.isSelectAll) {
            bookComponent.selected = true
          } else {
            bookComponent.selected = false
          }
        } else {
          bookComponent.setSelectionMode(false)
        }
        bookComponent.isHovering = false
        return
      }
      const shelfOffsetY = 16
      const row = index % this.entitiesPerShelf
      const shelfOffsetX = row * this.totalEntityCardWidth + this.bookshelfMarginLeft

      const ComponentClass = this.getComponentClass()

      const props = {
        index,
        width: this.entityWidth,
        height: this.entityHeight,
        bookCoverAspectRatio: this.coverAspectRatio,
        bookshelfView: this.bookshelfView,
        sortingIgnorePrefix: !!this.sortingIgnorePrefix
      }

      if (this.entityName === 'items') {
        props.filterBy = this.filterBy
        props.orderBy = this.orderBy
      } else if (this.entityName === 'series') {
        props.orderBy = this.seriesSortBy
      }

      const _this = this
      const instance = new ComponentClass({
        propsData: props,
        created() {
          this.$on('edit', (entity) => {
            if (_this.editEntity) _this.editEntity(entity)
          })
          this.$on('select', ({ entity, shiftKey }) => {
            if (_this.selectEntity) _this.selectEntity(entity, shiftKey)
          })
        }
      })
      this.entityComponentRefs[index] = instance

      instance.$mount()
      instance.$el.style.transform = `translate3d(${shelfOffsetX}px, ${shelfOffsetY}px, 0px)`
      instance.$el.classList.add('absolute', 'top-0', 'left-0')
      shelfEl.appendChild(instance.$el)

      if (this.entities[index]) {
        instance.setEntity(this.entities[index])
      }
      if (this.isSelectionMode) {
        instance.setSelectionMode(true)
        if (instance.libraryItemId && this.selectedMediaItems.some(i => i.id === instance.libraryItemId) || this.isSelectAll) {
          instance.selected = true
        }
      }
    },
  }
}
<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import Screenshot from './Screenshot.vue'
import { homeContent } from './homeContent'

const repository = 'https://github.com/aida0710/mado-s3-datacatalog'
const { lang } = useData()
const content = computed(() => homeContent(lang.value))
</script>

<template>
  <div class="docs-home">
    <section class="home-hero">
      <div class="home-hero-copy">
        <p class="home-eyebrow">{{ content.eyebrow }}</p>
        <h1>{{ content.title }}</h1>
        <p class="home-lead">{{ content.lead }}</p>
        <div class="home-actions">
          <a class="home-button primary" :href="withBase(content.primaryAction.link)">{{ content.primaryAction.text }}<span aria-hidden="true">→</span></a>
          <a class="home-button" :href="withBase(content.secondaryAction.link)">{{ content.secondaryAction.text }}</a>
        </div>
      </div>
      <Screenshot :src="`${content.screenshotDirectory}/storage-directory.png`" :alt="content.hero.alt" :caption="content.hero.caption" eager />
    </section>

    <nav class="home-entries" :aria-label="content.entriesLabel">
      <a v-for="entry in content.entries" :key="entry.link" class="home-entry" :href="withBase(entry.link)">
        <span class="home-entry-label">{{ entry.label }}</span>
        <strong>{{ entry.title }}</strong>
        <span class="home-entry-description">{{ entry.description }}</span>
        <span class="home-entry-arrow" aria-hidden="true">→</span>
      </a>
    </nav>

    <section class="home-features" aria-labelledby="features-heading">
      <h2 id="features-heading">{{ content.featuresHeading }}</h2>
      <article v-for="(feature, index) in content.features" :key="feature.image" class="home-feature" :class="{ reverse: index % 2 === 1 }">
        <div class="home-feature-copy">
          <p class="home-eyebrow">{{ feature.label }}</p>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.description }}</p>
          <a :href="withBase(feature.link)">{{ feature.action }} →</a>
        </div>
        <Screenshot :src="`${content.screenshotDirectory}/${feature.image}.png`" :alt="feature.alt" :caption="feature.alt" />
      </article>
    </section>

    <footer class="home-footer">
      <span>mado S3 Data Catalog</span>
      <a :href="repository">GitHub</a>
      <a :href="`${repository}/blob/main/LICENSE`">Apache License 2.0</a>
    </footer>
  </div>
</template>

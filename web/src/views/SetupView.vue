<script setup lang="ts">
// Settings she changes rarely: her name, people, meals of the day, weekly rules, rotation,
// the Today screen, backup.
import BackupCard from '@/components/setup/BackupCard.vue'
import EatersCard from '@/components/setup/EatersCard.vue'
import RotationCard from '@/components/setup/RotationCard.vue'
import RulesCard from '@/components/setup/RulesCard.vue'
import SlotsCard from '@/components/setup/SlotsCard.vue'
import TodayScreenCard from '@/components/setup/TodayScreenCard.vue'
import YouCard from '@/components/setup/YouCard.vue'
</script>

<template>
  <div>
    <h1 class="text-h5 mb-3">Setup</h1>
    <YouCard />
    <EatersCard />
    <SlotsCard />
    <RulesCard />
    <RotationCard />
    <TodayScreenCard />
    <BackupCard />
  </div>
</template>

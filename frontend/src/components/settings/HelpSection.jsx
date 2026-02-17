import React, { useState } from 'react';
import {
  FaBook,
  FaQuestionCircle,
  FaLifeRing,
  FaDownload,
  FaVideo,
  FaEnvelope,
  FaPhone,
  FaComments,
  FaGithub,
  FaFilePdf,
  FaLink,
  FaArrowRight,
  FaChevronDown,
  FaChevronUp,
  FaYoutube,
  FaBookOpen,
  FaHeadset,
  FaCode,
  FaUserFriends,
  FaGlobe,
  FaMobileAlt,
  FaDatabase
} from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import Card from '../common/Card';

const HelpSection = () => {
  const [expandedSection, setExpandedSection] = useState(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Simuler l'envoi du formulaire
    toast.success('Votre message a été envoyé à notre équipe de support');
    setContactForm({
      name: '',
      email: '',
      subject: '',
      message: ''
    });
  };

  const documentation = [
    {
      title: "Guide d'installation",
      description: "Instructions complètes pour l'installation et la configuration initiale",
      icon: <FaBookOpen className="h-6 w-6" />,
      link: "#",
      type: "pdf"
    },
    {
      title: "API Documentation",
      description: "Documentation technique de l'API REST",
      icon: <FaCode className="h-6 w-6" />,
      link: "#",
      type: "web"
    },
    {
      title: "Manuel utilisateur",
      description: "Guide complet pour les utilisateurs finaux",
      icon: <FaBook className="h-6 w-6" />,
      link: "#",
      type: "pdf"
    },
    {
      title: "Guide d'administration",
      description: "Configuration avancée pour les administrateurs",
      icon: <FaDatabase className="h-6 w-6" />,
      link: "#",
      type: "pdf"
    }
  ];

  const guides = [
    {
      title: "Premiers pas",
      steps: [
        "Configurer les informations de l'entreprise",
        "Ajouter vos premiers employés",
        "Définir les heures de travail",
        "Tester le système de pointage"
      ],
      estimatedTime: "15 minutes"
    },
    {
      title: "Configuration des Shifts",
      steps: [
        "Créer des shifts personnalisés",
        "Assigner des shifts aux employés",
        "Configurer les rotations automatiques",
        "Gérer les exceptions"
      ],
      estimatedTime: "30 minutes"
    },
    {
      title: "Gestion des absences",
      steps: [
        "Configurer les types d'absences",
        "Définir les politiques de congés",
        "Configurer les notifications",
        "Approuver les demandes"
      ],
      estimatedTime: "20 minutes"
    },
    {
      title: "Génération de rapports",
      steps: [
        "Configurer les modèles de rapports",
        "Automatiser l'envoi des rapports",
        "Personnaliser les colonnes",
        "Exporter vers Excel/PDF"
      ],
      estimatedTime: "25 minutes"
    }
  ];

  const tutorials = [
    {
      title: "Pointage facial",
      description: "Comment configurer et utiliser la reconnaissance faciale",
      videoId: "demo1",
      duration: "5:30",
      level: "Débutant"
    },
    {
      title: "Gestion des équipes",
      description: "Organiser vos équipes et départements",
      videoId: "demo2",
      duration: "8:15",
      level: "Intermédiaire"
    },
    {
      title: "API d'intégration",
      description: "Intégrer avec votre système RH existant",
      videoId: "demo3",
      duration: "12:45",
      level: "Avancé"
    },
    {
      title: "Notifications automatisées",
      description: "Configurer les alertes et rappels",
      videoId: "demo4",
      duration: "6:20",
      level: "Débutant"
    }
  ];

  const supportChannels = [
    {
      type: "email",
      title: "Support par email",
      description: "Réponse sous 24 heures",
      icon: <FaEnvelope className="h-6 w-6" />,
      contact: "support@smartattendance.com",
      available: "24/7"
    },
    {
      type: "phone",
      title: "Support téléphonique",
      description: "Support direct",
      icon: <FaPhone className="h-6 w-6" />,
      contact: "+33 1 23 45 67 89",
      available: "Lun-Ven 9h-18h"
    },
    {
      type: "chat",
      title: "Chat en direct",
      description: "Réponse immédiate",
      icon: <FaComments className="h-6 w-6" />,
      contact: "Disponible sur le site",
      available: "Lun-Ven 9h-17h"
    },
    {
      type: "community",
      title: "Communauté",
      description: "Forum d'entraide",
      icon: <FaUserFriends className="h-6 w-6" />,
      contact: "community.smartattendance.com",
      available: "Toujours"
    }
  ];

  const faqs = [
    {
      question: "Comment réinitialiser un mot de passe administrateur ?",
      answer: "Connectez-vous via SSH et exécutez la commande 'php artisan admin:reset-password' ou contactez le support technique."
    },
    {
      question: "Quels sont les navigateurs supportés ?",
      answer: "Chrome 80+, Firefox 75+, Safari 13+, Edge 80+. Nous recommandons d'utiliser la dernière version disponible."
    },
    {
      question: "Comment migrer depuis un ancien système ?",
      answer: "Utilisez notre outil d'importation CSV ou notre API. Consultez la section 'Migration' dans la documentation."
    },
    {
      question: "Est-ce que le système fonctionne hors ligne ?",
      answer: "Oui, le système peut fonctionner en mode hors ligne limité pour le pointage, puis synchroniser automatiquement lors de la reconnexion."
    },
    {
      question: "Comment sauvegarder mes données ?",
      answer: "Les sauvegardes automatiques sont configurées quotidiennement. Vous pouvez aussi exporter manuellement depuis les paramètres."
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <FaHeadset className="text-primary-600" />
          Centre d'aide et support
        </h1>
        <p className="mt-2 text-gray-600">
          Trouvez toutes les ressources nécessaires pour configurer et utiliser Smart Attendance System
        </p>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <FaBook className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Guides disponibles</p>
              <p className="text-2xl font-bold text-gray-900">24+</p>
            </div>
          </div>
        </Card>
        
        <Card className="bg-gradient-to-r from-green-50 to-green-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <FaVideo className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Tutoriels vidéo</p>
              <p className="text-2xl font-bold text-gray-900">18</p>
            </div>
          </div>
        </Card>
        
        <Card className="bg-gradient-to-r from-purple-50 to-purple-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500 rounded-lg">
              <FaQuestionCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">FAQ</p>
              <p className="text-2xl font-bold text-gray-900">45+</p>
            </div>
          </div>
        </Card>
        
        <Card className="bg-gradient-to-r from-orange-50 to-orange-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500 rounded-lg">
              <FaLifeRing className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Taux de résolution</p>
              <p className="text-2xl font-bold text-gray-900">98%</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Documentation */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <FaBook className="text-primary-600" />
                Documentation des paramètres
              </h3>
              <button
                onClick={() => toggleSection('documentation')}
                className="text-primary-600 hover:text-primary-700"
              >
                {expandedSection === 'documentation' ? <FaChevronUp /> : <FaChevronDown />}
              </button>
            </div>
            
            {expandedSection === 'documentation' && (
              <div className="mt-4">
                <p className="text-gray-600 mb-6">
                  Téléchargez les guides complets et documentation technique pour configurer votre système.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documentation.map((doc, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary-100 rounded-lg">
                          {doc.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{doc.title}</h4>
                          <p className="text-sm text-gray-500 mt-1">{doc.description}</p>
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={() => toast.success(`Téléchargement de ${doc.title}`)}
                              className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm"
                            >
                              <FaDownload className="h-3 w-3" />
                              Télécharger PDF
                            </button>
                            <span className="text-gray-300">•</span>
                            <button
                              onClick={() => toast.info('Ouverture dans le navigateur')}
                              className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm"
                            >
                              <FaGlobe className="h-3 w-3" />
                              Voir en ligne
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Documentation API</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Accédez à la documentation complète de notre API REST pour l'intégration avec vos systèmes existants.
                  </p>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      toast.info('Redirection vers la documentation API');
                    }}
                    className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Explorer l'API <FaArrowRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}
          </Card>

          {/* Guide de configuration */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <FaQuestionCircle className="text-primary-600" />
                Guide de configuration étape par étape
              </h3>
              <button
                onClick={() => toggleSection('guides')}
                className="text-primary-600 hover:text-primary-700"
              >
                {expandedSection === 'guides' ? <FaChevronUp /> : <FaChevronDown />}
              </button>
            </div>
            
            {expandedSection === 'guides' && (
              <div className="mt-4">
                <p className="text-gray-600 mb-6">
                  Suivez ces guides structurés pour configurer rapidement et efficacement votre système.
                </p>
                
                <div className="space-y-4">
                  {guides.map((guide, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{guide.title}</h4>
                          <p className="text-sm text-gray-500 mt-1">Durée estimée: {guide.estimatedTime}</p>
                          
                          <ul className="mt-3 space-y-2">
                            {guide.steps.map((step, stepIndex) => (
                              <li key={stepIndex} className="flex items-start gap-2">
                                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary-100 text-primary-600 text-xs font-medium mt-0.5">
                                  {stepIndex + 1}
                                </span>
                                <span className="text-sm text-gray-700">{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <button
                          onClick={() => toast.success(`Démarrage du guide: ${guide.title}`)}
                          className="ml-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition-colors"
                        >
                          Démarrer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">Ressources supplémentaires</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      onClick={() => toast.success('Téléchargement du guide de migration')}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FaDatabase className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">Guide de migration</p>
                          <p className="text-xs text-gray-500">Migrer depuis Excel/autres systèmes</p>
                        </div>
                      </div>
                      <FaDownload className="h-4 w-4 text-gray-400" />
                    </button>
                    
                    <button
                      onClick={() => toast.success('Ouverture des meilleures pratiques')}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FaBookOpen className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">Meilleures pratiques</p>
                          <p className="text-xs text-gray-500">Optimiser votre configuration</p>
                        </div>
                      </div>
                      <FaArrowRight className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Tutoriels vidéo */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <FaYoutube className="text-red-600" />
                Tutoriels vidéo
              </h3>
              <button
                onClick={() => toggleSection('tutorials')}
                className="text-primary-600 hover:text-primary-700"
              >
                {expandedSection === 'tutorials' ? <FaChevronUp /> : <FaChevronDown />}
              </button>
            </div>
            
            {expandedSection === 'tutorials' && (
              <div className="mt-4">
                <p className="text-gray-600 mb-6">
                  Apprenez à utiliser toutes les fonctionnalités grâce à nos tutoriels vidéo détaillés.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tutorials.map((tutorial, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Placeholder pour vidéo */}
                      <div className="h-40 bg-gradient-to-r from-gray-800 to-gray-900 flex items-center justify-center">
                        <div className="text-center">
                          <FaVideo className="h-12 w-12 text-white opacity-50 mx-auto" />
                          <p className="text-white text-sm mt-2">{tutorial.duration}</p>
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{tutorial.title}</h4>
                            <p className="text-sm text-gray-500 mt-1">{tutorial.description}</p>
                          </div>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {tutorial.level}
                          </span>
                        </div>
                        
                        <button
                          onClick={() => toast.info(`Lecture de: ${tutorial.title}`)}
                          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          <FaPlay className="h-4 w-4" />
                          Regarder le tutoriel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 text-center">
                  <button
                    onClick={() => toast.info('Redirection vers la chaîne YouTube')}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:border-gray-400 text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    <FaYoutube className="h-5 w-5 text-red-600" />
                    Voir tous les tutoriels sur YouTube
                  </button>
                </div>
              </div>
            )}
          </Card>

          {/* FAQ */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <FaQuestionCircle className="text-primary-600" />
                Questions fréquentes (FAQ)
              </h3>
              <button
                onClick={() => toggleSection('faq')}
                className="text-primary-600 hover:text-primary-700"
              >
                {expandedSection === 'faq' ? <FaChevronUp /> : <FaChevronDown />}
              </button>
            </div>
            
            {expandedSection === 'faq' && (
              <div className="mt-4">
                <div className="space-y-4">
                  {faqs.map((faq, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg">
                      <button
                        onClick={() => toggleSection(`faq-${index}`)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-medium text-gray-900">{faq.question}</span>
                        {expandedSection === `faq-${index}` ? (
                          <FaChevronUp className="h-4 w-4 text-gray-400" />
                        ) : (
                          <FaChevronDown className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                      
                      {expandedSection === `faq-${index}` && (
                        <div className="p-4 pt-0">
                          <p className="text-gray-600">{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Vous ne trouvez pas votre réponse ?</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Contactez notre équipe de support pour une assistance personnalisée.
                  </p>
                  <button
                    onClick={() => document.getElementById('contact-form').scrollIntoView({ behavior: 'smooth' })}
                    className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Contacter le support <FaArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </Card>

          {/* Formulaire de contact */}
          <Card id="contact-form">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <FaEnvelope className="text-primary-600" />
              Contactez notre équipe de support
            </h3>
            
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom complet *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={contactForm.name}
                    onChange={handleContactChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={contactForm.email}
                    onChange={handleContactChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sujet
                </label>
                <input
                  type="text"
                  name="subject"
                  value={contactForm.subject}
                  onChange={handleContactChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Ex: Problème de configuration, Bug, Question technique..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message *
                </label>
                <textarea
                  name="message"
                  value={contactForm.message}
                  onChange={handleContactChange}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                  placeholder="Décrivez en détail votre problème ou question..."
                />
              </div>
              
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-gray-500">
                  <p>Nous répondons généralement dans les 24 heures.</p>
                  <p>Pour les urgences, utilisez le support téléphonique.</p>
                </div>
                
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors"
                >
                  Envoyer le message
                </button>
              </div>
            </form>
          </Card>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          {/* Canaux de support */}
          <Card>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Canaux de support</h3>
            <div className="space-y-3">
              {supportChannels.map((channel, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      {channel.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{channel.title}</h4>
                      <p className="text-sm text-gray-500">{channel.description}</p>
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-900">{channel.contact}</p>
                        <p className="text-xs text-gray-500">Disponible: {channel.available}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Statut du système */}
          <Card>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Statut du système</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Système principal</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Opérationnel
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Base de données</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  En ligne
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-700">API Services</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Normal
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Support technique</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Disponible
                </span>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info('Ouverture de la page de statut');
                  }}
                  className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 text-sm"
                >
                  <FaLink className="h-3 w-3" />
                  Voir la page de statut détaillée
                </a>
              </div>
            </div>
          </Card>

          {/* Ressources rapides */}
          <Card>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Ressources rapides</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleSection('documentation');
                  }}
                  className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
                >
                  <FaBookOpen className="h-4 w-4" />
                  Documentation technique
                </a>
              </li>
              <li>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.success('Téléchargement du manuel');
                  }}
                  className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
                >
                  <FaFilePdf className="h-4 w-4" />
                  Manuel d'utilisation PDF
                </a>
              </li>
              <li>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info('Ouverture du dépôt GitHub');
                  }}
                  className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
                >
                  <FaGithub className="h-4 w-4" />
                  Dépôt GitHub
                </a>
              </li>
              <li>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleSection('faq');
                  }}
                  className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
                >
                  <FaQuestionCircle className="h-4 w-4" />
                  FAQ complète
                </a>
              </li>
            </ul>
          </Card>

          {/* Application mobile */}
          <Card className="bg-gradient-to-r from-primary-50 to-primary-100">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <FaMobileAlt className="h-8 w-8 text-primary-600" />
                <div>
                  <h4 className="font-medium text-gray-900">Application mobile</h4>
                  <p className="text-sm text-gray-600">Téléchargez notre app</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => toast.success('Redirection vers App Store')}
                  className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors"
                >
                  App Store
                </button>
                <button
                  onClick={() => toast.success('Redirection vers Google Play')}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                >
                  Google Play
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default HelpSection;
